use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const V1: &str  = "https://graph.microsoft.com/v1.0";
const BETA: &str = "https://graph.microsoft.com/beta";

// ---------------------------------------------------------------------------
//  SKU -> friendly name map
// ---------------------------------------------------------------------------
pub fn friendly_sku(sku: &str) -> &str {
    match sku {
        "MCOEV"                     => "Teams Phone Standard",
        "MCOEV_VIRTUALUSER"         => "Teams Phone Resource Account",
        "MCOPSTN1"                  => "Teams Calling Plan National",
        "MCOPSTN2"                  => "Teams Calling Plan International",
        "MCOPSTN_5"                 => "Teams Calling Plan PAYG",
        "MCOPSTNC"                  => "Teams Communication Credits",
        "MCOCAP"                    => "Teams Shared Devices",
        "SPE_E3"                    => "Microsoft 365 E3",
        "SPE_E5"                    => "Microsoft 365 E5",
        "SPB"                       => "Microsoft 365 Business Premium",
        "O365_BUSINESS_ESSENTIALS"  => "Microsoft 365 Business Basic",
        "O365_BUSINESS_PREMIUM"     => "Microsoft 365 Business Standard",
        "ENTERPRISEPACK"            => "Office 365 E3",
        "ENTERPRISEPREMIUM"         => "Office 365 E5",
        "POWER_BI_PRO"              => "Power BI Pro",
        "POWER_BI_PREMIUM_PER_USER" => "Power BI Premium Per User",
        "EMS"                       => "EMS E3",
        "EMSPREMIUM"                => "EMS E5",
        "AAD_PREMIUM"               => "Azure AD Premium P1",
        "AAD_PREMIUM_P2"            => "Azure AD Premium P2",
        "INTUNE_A"                  => "Intune",
        "PROJECTPREMIUM"            => "Project Plan 5",
        "PROJECTPROFESSIONAL"       => "Project Plan 3",
        "VISIOCLIENT"               => "Visio Plan 2",
        other                       => other,
    }
}

// ---------------------------------------------------------------------------
//  Output models (all Serialize so we can send to frontend)
// ---------------------------------------------------------------------------
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PhoneUser {
    pub display_name:      String,
    pub upn:               String,
    pub phone_number:      String,
    pub ev_enabled:        String,
    pub account_enabled:   String,
    pub usage_location:    String,
    pub licenses:          String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct FreeNumber {
    pub number:      String,
    pub number_type: String,
    pub city:        String,
    pub country:     String,
    pub capability:  String,
    pub status:      String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserLicense {
    pub display_name:    String,
    pub upn:             String,
    pub sku_part_number: String,
    pub friendly_name:   String,
    pub account_enabled: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    pub friendly_name: String,
    pub sku:           String,
    pub purchased:     i64,
    pub suspended:     i64,
    pub consumed:      i64,
    pub available:     i64,
    pub status:        String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CallQueue {
    pub name:            String,
    pub language:        String,
    pub routing_method:  String,
    pub agent_count:     i64,
    pub timeout_action:  String,
    pub overflow_action: String,
    pub phone_number:    String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AutoAttendant {
    pub name:         String,
    pub language:     String,
    pub time_zone:    String,
    pub phone_number: String,
    pub status:       String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResourceAccount {
    pub display_name:  String,
    pub upn:           String,
    pub account_type:  String,
    pub phone_number:  String,
    pub licensed:      String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct OrphanLicense {
    pub upn:         String,
    pub display_name: String,
    pub licenses:    String,
    pub status:      String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub directory_users:   Vec<DirectoryUser>,
    pub phone_users:       Vec<PhoneUser>,
    pub free_numbers:      Vec<FreeNumber>,
    pub user_licenses:     Vec<UserLicense>,
    pub subscriptions:     Vec<Subscription>,
    pub call_queues:       Vec<CallQueue>,
    pub auto_attendants:   Vec<AutoAttendant>,
    pub resource_accounts: Vec<ResourceAccount>,
    pub orphan_licenses:   Vec<OrphanLicense>,
    pub errors:            Vec<String>,
    pub warnings:          Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryUser {
    pub display_name: String,
    pub upn: String,
    pub account_enabled: String,
    pub usage_location: String,
    pub licenses: String,
    pub phone_number: String,
    pub has_phone_license: String,
}

// ---------------------------------------------------------------------------
//  Generic paginated fetch
// ---------------------------------------------------------------------------
async fn fetch_pages(client: &Client, token: &str, url: &str) -> Result<Vec<Value>, String> {
    let mut items: Vec<Value> = Vec::new();
    let mut next = Some(url.to_string());

    while let Some(u) = next {
        let resp = client
            .get(&u)
            .bearer_auth(token)
            .header("ConsistencyLevel", "eventual")
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let st   = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("HTTP {} from {}: {}", st, u, body));
        }

        let json: Value = resp.json().await.map_err(|e| e.to_string())?;

        if let Some(arr) = json.get("value").and_then(|v| v.as_array()) {
            items.extend(arr.clone());
        }
        next = json.get("@odata.nextLink")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
    }
    Ok(items)
}

fn str_val(v: &Value, key: &str) -> String {
    v.get(key)
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string()
}
fn bool_val(v: &Value, key: &str) -> bool {
    v.get(key).and_then(|x| x.as_bool()).unwrap_or(false)
}
fn i64_val(v: &Value, key: &str) -> i64 {
    v.get(key).and_then(|x| x.as_i64()).unwrap_or(0)
}

fn str_array(v: &Value, key: &str) -> Vec<String> {
    v.get(key)
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default()
}

fn is_phone_related_sku(sku: &str) -> bool {
    matches!(
        sku,
        "MCOEV"
            | "MCOEV_VIRTUALUSER"
            | "MCOPSTN1"
            | "MCOPSTN2"
            | "MCOPSTN_5"
            | "MCOPSTNC"
            | "PHONESYSTEM_VIRTUALUSER"
    )
}

fn dedup_keep_order(values: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for v in values {
        if !v.is_empty() && seen.insert(v.clone()) {
            out.push(v);
        }
    }
    out
}

// ---------------------------------------------------------------------------
//  Main data collection
// ---------------------------------------------------------------------------
pub async fn collect_all(client: &Client, token: &str) -> DashboardData {
    let mut data = DashboardData::default();

    // ── 1. Subscriptions tenant ──────────────────────────────────────────
    match fetch_pages(client, token, &format!("{}/subscribedSkus", V1)).await {
        Err(e) => data.errors.push(format!("Subscriptions: {}", e)),
        Ok(skus) => {
            // Build local SkuId -> SkuPartNumber map for later use
            let mut sku_id_map: std::collections::HashMap<String, String> = Default::default();
            for s in &skus {
                let id   = str_val(s, "skuId");
                let part = str_val(s, "skuPartNumber");
                if !id.is_empty() { sku_id_map.insert(id, part.clone()); }

                let enabled   = s.get("prepaidUnits")
                    .and_then(|u| u.get("enabled"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let suspended = s.get("prepaidUnits")
                    .and_then(|u| u.get("suspended"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let consumed  = i64_val(s, "consumedUnits");
                let available = enabled - consumed;
                let status = if available < 0 { "DEPASSEMENT".into() }
                    else if available == 0 { "EPUISE".into() }
                    else { "OK".into() };

                data.subscriptions.push(Subscription {
                    friendly_name: friendly_sku(&str_val(s, "skuPartNumber")).to_string(),
                    sku:           str_val(s, "skuPartNumber"),
                    purchased:     enabled,
                    suspended,
                    consumed,
                    available,
                    status,
                });
            }
            data.subscriptions.sort_by(|a, b| b.consumed.cmp(&a.consumed));

            // ── 2. Teams number assignments (source of truth for phone numbers) ──
            let mut assigned_numbers_by_target: std::collections::HashMap<String, Vec<String>> =
                Default::default();

            match fetch_pages(
                client,
                token,
                &format!(
                    "{}/admin/teams/telephoneNumberManagement/numberAssignments?$top=999",
                    BETA
                ),
            )
            .await
            {
                Err(e) => {
                    data.warnings.push(format!(
                        "Inventaire des numeros Teams indisponible via /admin/teams/telephoneNumberManagement/numberAssignments ({}). \
                         Fallback sur businessPhones : certaines detections peuvent etre inexactes.",
                        e
                    ));
                }
                Ok(assignments) => {
                    for n in assignments {
                        let telephone_number = str_val(&n, "telephoneNumber");
                        let assignment_target_id = str_val(&n, "assignmentTargetId");
                        let assignment_status = str_val(&n, "assignmentStatus");
                        let capabilities = str_array(&n, "capabilities");

                        // Numéro réellement affecté à un user / resource account
                        if !assignment_target_id.is_empty()
                            && !telephone_number.is_empty()
                            && assignment_status != "unassigned"
                        {
                            assigned_numbers_by_target
                                .entry(assignment_target_id)
                                .or_default()
                                .push(telephone_number.clone());
                        }

                        // Numéros libres pour utilisateurs
                        if assignment_status == "unassigned"
                            && capabilities.iter().any(|c| c == "userAssignment")
                        {
                            data.free_numbers.push(FreeNumber {
                                number: telephone_number,
                                number_type: str_val(&n, "numberType"),
                                city: str_val(&n, "city"),
                                country: str_val(&n, "isoCountryCode"),
                                capability: capabilities.join(", "),
                                status: "Libre".into(),
                            });
                        }
                    }

                    for nums in assigned_numbers_by_target.values_mut() {
                        *nums = dedup_keep_order(std::mem::take(nums));
                    }
                }
            }

            // ── 3. Users (all with licenses) ─────────────────────────────
            let user_url = format!(
                "{}/users?$select=id,displayName,userPrincipalName,businessPhones,\
                assignedLicenses,accountEnabled,usageLocation&$top=999",
                V1
            );
            match fetch_pages(client, token, &user_url).await {
                Err(e) => data.errors.push(format!("Users: {}", e)),
                Ok(users) => {
                    let phone_skus: Vec<&str> = vec![
                        "MCOEV", "MCOEV_VIRTUALUSER", "MCOPSTN1", "MCOPSTN2", "MCOPSTN_5",
                    ];

                    let mut upns_with_number: std::collections::HashSet<String> = Default::default();

                    for u in &users {
                        let upn   = str_val(u, "userPrincipalName");
                        let name  = str_val(u, "displayName");
                        let enabled = bool_val(u, "accountEnabled");
                        let location = str_val(u, "usageLocation");

                        // Resolve license SKUs
                        let lic_skus: Vec<String> = u.get("assignedLicenses")
                            .and_then(|l| l.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|l| l.get("skuId")?.as_str())
                                    .filter_map(|id| sku_id_map.get(id))
                                    .cloned()
                                    .collect()
                            })
                            .unwrap_or_default();

                        let user_id = str_val(u, "id");
                        // Fallback legacy / display only
                        let business_phones: Vec<String> = str_array(u, "businessPhones");

                        // Source of truth = numberAssignments
                        let assigned_phones: Vec<String> = assigned_numbers_by_target
                            .get(&user_id)
                            .cloned()
                            .unwrap_or_default();

                        // Teams numbers first, businessPhones only as fallback display
                        let phones: Vec<String> = if !assigned_phones.is_empty() {
                            assigned_phones
                        } else {
                            business_phones
                        };
                        
                        // Phone numbers
                        /*let phones: Vec<String> = u.get("businessPhones")
                            .and_then(|p| p.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|v| v.as_str())
                                    .map(|s| s.to_string())
                                    .collect()
                            })
                            .unwrap_or_default();*/

                        // User licenses rows
                        for sku in &lic_skus {
                            data.user_licenses.push(UserLicense {
                                display_name:    name.clone(),
                                upn:             upn.clone(),
                                sku_part_number: sku.clone(),
                                friendly_name:   friendly_sku(sku).to_string(),
                                account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                            });
                        }

                        // @@Ajout ChatGPT
                        let phone_license_names = lic_skus.iter()
                            .filter(|s| phone_skus.contains(&s.as_str()))
                            .map(|s| friendly_sku(s).to_string())
                            .collect::<Vec<_>>();

                        data.directory_users.push(DirectoryUser {
                            display_name: name.clone(),
                            upn: upn.clone(),
                            account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                            usage_location: location.clone(),
                            licenses: lic_skus.iter()
                                .map(|s| friendly_sku(s).to_string())
                                .collect::<Vec<_>>()
                                .join(", "),
                            phone_number: if phones.is_empty() { "-".into() } else { phones.join(", ") },
                            has_phone_license: if phone_license_names.is_empty() { "Non".into() } else { "Oui".into() },
                        });

                        // Users with Teams number detected
                        if !phones.is_empty() {
                            let has_phone_lic = lic_skus.iter().any(|s| is_phone_related_sku(s));
                            upns_with_number.insert(upn.clone());

                            data.phone_users.push(PhoneUser {
                                display_name:    name.clone(),
                                upn:             upn.clone(),
                                phone_number:    phones.join(", "),
                                ev_enabled:      if has_phone_lic { "Oui".into() } else { "Non".into() },
                                account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                                usage_location:  location.clone(),
                                licenses:        lic_skus.iter()
                                    .filter(|s| is_phone_related_sku(s))
                                    .map(|s| friendly_sku(s).to_string())
                                    .collect::<Vec<_>>()
                                    .join(", "),
                            });
                        }

                        // Resource accounts (MCOEV_VIRTUALUSER)
                        if lic_skus.iter().any(|s| s == "MCOEV_VIRTUALUSER") {
                            let phone = if phones.is_empty() {
                                "-".into()
                            } else {
                                phones.join(", ")
                            };
                            let acct_type = if name.to_lowercase().contains("aa ")
                                || name.to_lowercase().contains("auto attendant")
                                || name.to_lowercase().starts_with("aa-")
                            {
                                "Auto Attendant"
                            } else if name.to_lowercase().contains("cq ")
                                || name.to_lowercase().contains("call queue")
                                || name.to_lowercase().starts_with("cq-")
                            {
                                "Call Queue"
                            } else {
                                "Resource Account"
                            };
                            data.resource_accounts.push(ResourceAccount {
                                display_name: name.clone(),
                                upn:          upn.clone(),
                                account_type: acct_type.to_string(),
                                phone_number: phone,
                                licensed:     "Oui".into(),
                            });
                        }

                        // Orphan licenses: has phone sku but no number
                        let phone_lics: Vec<String> = lic_skus.iter()
                            .filter(|s| is_phone_related_sku(s) && *s != "MCOEV_VIRTUALUSER")
                            .cloned()
                            .collect();

                        let has_teams_number = !assigned_numbers_by_target
                            .get(&user_id)
                            .cloned()
                            .unwrap_or_default()
                            .is_empty();

                        if !phone_lics.is_empty() && !has_teams_number && enabled {
                            data.orphan_licenses.push(OrphanLicense {
                                upn:          upn.clone(),
                                display_name: name.clone(),
                                licenses:     phone_lics.iter()
                                    .map(|s| friendly_sku(s).to_string())
                                    .collect::<Vec<_>>()
                                    .join(", "),
                                status: "Licence phone sans numero Teams detecte".into(),
                            });
                        }
                    }
                }
            }
        }
    }

    // ── 4. Call Queues (beta) ─────────────────────────────────────────────
    match fetch_pages(client, token, &format!("{}/solutions/businessApplications/callQueues", BETA)).await {
        Err(_e) => {
            // Fallback: derive from resource accounts
            for ra in data.resource_accounts.iter().filter(|r| r.account_type == "Call Queue") {
                data.call_queues.push(CallQueue {
                    name:           ra.display_name.clone(),
                    language:       "N/A".into(),
                    routing_method: "N/A".into(),
                    agent_count:    0,
                    timeout_action: "N/A".into(),
                    overflow_action:"N/A".into(),
                    phone_number:   ra.phone_number.clone(),
                });
            }
            if data.call_queues.is_empty() {
                data.warnings.push(
                    "Call Queues: details complets necessitent le module Teams PowerShell ou Teams Admin API. \
                     Les comptes ressources de type CQ sont visibles dans l'onglet Comptes Ressources.".into()
                );
            }
        }
        Ok(cqs) => {
            for q in cqs {
                data.call_queues.push(CallQueue {
                    name:           str_val(&q, "displayName"),
                    language:       str_val(&q, "languageId"),
                    routing_method: str_val(&q, "routingMethod"),
                    agent_count:    i64_val(&q, "agentCount"),
                    timeout_action: str_val(&q, "timeoutAction"),
                    overflow_action:str_val(&q, "overflowAction"),
                    phone_number:   q.get("phoneNumbers")
                        .and_then(|p| p.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|v| v.as_str())
                        .unwrap_or("-")
                        .to_string(),
                });
            }
        }
    }

    // ── 5. Auto Attendants (beta) ─────────────────────────────────────────
    match fetch_pages(client, token, &format!("{}/solutions/businessApplications/autoAttendants", BETA)).await {
        Err(_e) => {
            for ra in data.resource_accounts.iter().filter(|r| r.account_type == "Auto Attendant") {
                data.auto_attendants.push(AutoAttendant {
                    name:         ra.display_name.clone(),
                    language:     "N/A".into(),
                    time_zone:    "N/A".into(),
                    phone_number: ra.phone_number.clone(),
                    status:       "Actif".into(),
                });
            }
            if data.auto_attendants.is_empty() {
                data.warnings.push(
                    "Auto Attendants: details complets necessitent le module Teams PowerShell ou Teams Admin API. \
                     Les comptes ressources de type AA sont visibles dans l'onglet Comptes Ressources.".into()
                );
            }
        }
        Ok(aas) => {
            for a in aas {
                data.auto_attendants.push(AutoAttendant {
                    name:         str_val(&a, "displayName"),
                    language:     str_val(&a, "languageId"),
                    time_zone:    str_val(&a, "timeZoneId"),
                    phone_number: a.get("phoneNumbers")
                        .and_then(|p| p.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|v| v.as_str())
                        .unwrap_or("-")
                        .to_string(),
                    status: "Actif".into(),
                });
            }
        }
    }

    data
}