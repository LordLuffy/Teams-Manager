use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tokio::time::sleep;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceCodeInfo {
    pub device_code:      String,
    pub user_code:        String,
    pub verification_uri: String,
    pub expires_in:       u64,
    pub interval:         u64,
    pub message:          String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenSet {
    pub access_token:  String,
    pub refresh_token: Option<String>,
    pub expires_in:    u64,
    pub obtained_at:   u64,
}

impl TokenSet {
    pub fn is_expired(&self) -> bool {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        now >= self.obtained_at + self.expires_in.saturating_sub(60)
    }
}

pub async fn start_device_code(
    client: &Client,
    tenant_id: &str,
    client_id: &str,
) -> Result<DeviceCodeInfo, String> {
    let url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/devicecode",
        tenant_id
    );
    let params = [
        ("client_id", client_id),
        ("scope", "https://graph.microsoft.com/.default offline_access"),
    ];
    let resp = client
        .post(&url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        let msg: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
        let desc = msg.get("error_description")
            .and_then(|v| v.as_str())
            .unwrap_or(&body);
        return Err(format!("Auth error {}: {}", status, desc));
    }

    resp.json::<DeviceCodeInfo>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

pub async fn poll_token(
    client: &Client,
    tenant_id: &str,
    client_id: &str,
    device_code: &str,
    interval: u64,
) -> Result<TokenSet, String> {
    let url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );
    let deadline = Instant::now() + Duration::from_secs(600);

    loop {
        sleep(Duration::from_secs(interval)).await;

        if Instant::now() > deadline {
            return Err("Authentication timed out (10 min)".into());
        }

        let params = [
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("device_code", device_code),
            ("client_id", client_id),
        ];
        let resp = client
            .post(&url)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        let body = resp.text().await.unwrap_or_default();
        let json: serde_json::Value =
            serde_json::from_str(&body).unwrap_or_default();

        if let Some(token) = json.get("access_token").and_then(|v| v.as_str()) {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            return Ok(TokenSet {
                access_token:  token.to_string(),
                refresh_token: json.get("refresh_token")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                expires_in:   json.get("expires_in")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(3600),
                obtained_at:  now,
            });
        }

        match json.get("error").and_then(|v| v.as_str()) {
            Some("authorization_pending") => continue,
            Some("slow_down") => {
                sleep(Duration::from_secs(5)).await;
                continue;
            }
            Some("authorization_declined") => return Err("User declined authorization".into()),
            Some("expired_token") => return Err("Device code expired. Please retry.".into()),
            Some(e) => {
                let desc = json.get("error_description")
                    .and_then(|v| v.as_str())
                    .unwrap_or(e);
                return Err(format!("Auth error: {}", desc));
            }
            None => return Err(format!("Unexpected response: {}", body)),
        }
    }
}

pub async fn refresh_access_token(
    client: &Client,
    tenant_id: &str,
    client_id: &str,
    refresh_token: &str,
) -> Result<TokenSet, String> {
    let url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", client_id),
        ("scope", "https://graph.microsoft.com/.default offline_access"),
    ];
    let resp = client
        .post(&url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let body = resp.text().await.unwrap_or_default();
    let json: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();

    if let Some(token) = json.get("access_token").and_then(|v| v.as_str()) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        return Ok(TokenSet {
            access_token:  token.to_string(),
            refresh_token: json.get("refresh_token")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            expires_in:   json.get("expires_in")
                .and_then(|v| v.as_u64())
                .unwrap_or(3600),
            obtained_at:  now,
        });
    }
    Err(format!("Refresh failed: {}", body))
}