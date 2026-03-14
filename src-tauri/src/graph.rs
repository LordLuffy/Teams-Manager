use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const V1: &str = "https://graph.microsoft.com/v1.0";
const BETA: &str = "https://graph.microsoft.com/beta";

pub fn friendly_sku(sku: &str) -> &str {
    match sku {
        "MCOEV" => "Teams Phone Standard",
        "MCOEV_VIRTUALUSER" => "Teams Phone Resource Account",
        "MCOPSTN1" => "Teams Calling Plan National",
        "MCOPSTN2" => "Teams Calling Plan International",
        "MCOPSTN_5" => "Teams Calling Plan PAYG",
        "MCOPSTNC" => "Teams Communication Credits",
        "MCOCAP" => "Teams Shared Devices",
        "SPE_E3" => "Microsoft 365 E3",
        "SPE_E5" => "Microsoft 365 E5",
        "SPB" => "Microsoft 365 Business Premium",
        "O365_BUSINESS_ESSENTIALS" => "Microsoft 365 Business Basic",
        "O365_BUSINESS_PREMIUM" => "Microsoft 365 Business Standard",
        "ENTERPRISEPACK" => "Office 365 E3",
        "ENTERPRISEPREMIUM" => "Office 365 E5",
        "POWER_BI_PRO" => "Power BI Pro",
        "POWER_BI_PREMIUM_PER_USER" => "Power BI Premium Per User",
        "EMS" => "EMS E3",
        "EMSPREMIUM" => "EMS E5",
        "AAD_PREMIUM" => "Azure AD Premium P1",
        "AAD_PREMIUM_P2" => "Azure AD Premium P2",
        "INTUNE_A" => "Intune",
        "PROJECTPREMIUM" => "Project Plan 5",
        "PROJECTPROFESSIONAL" => "Project Plan 3",
        "VISIOCLIENT" => "Visio Plan 2",
        other => other,
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PhoneUser {
    pub display_name: String,
    pub upn: String,
    pub phone_number: String,
    pub ev_enabled: String,
    pub account_enabled: String,
    pub usage_location: String,
    pub licenses: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct FreeNumber {
    pub number: String,
    pub number_type: String,
    pub city: String,
    pub country: String,
    pub capability: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserLicense {
    pub display_name: String,
    pub upn: String,
    pub sku_part_number: String,
    pub friendly_name: String,
    pub account_enabled: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    pub friendly_name: String,
    pub sku: String,
    pub purchased: i64,
    pub suspended: i64,
    pub consumed: i64,
    pub available: i64,
    pub status: String,
    pub is_free: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CallQueue {
    pub name: String,
    pub language: String,
    pub routing_method: String,
    pub agent_count: i64,
    pub timeout_action: String,
    pub overflow_action: String,
    pub phone_number: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AutoAttendant {
    pub name: String,
    pub language: String,
    pub time_zone: String,
    pub phone_number: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResourceAccount {
    pub display_name: String,
    pub upn: String,
    pub account_type: String,
    pub phone_number: String,
    pub licensed: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct OrphanLicense {
    pub upn: String,
    pub display_name: String,
    pub licenses: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub directory_users: Vec<DirectoryUser>,
    pub phone_users: Vec<PhoneUser>,
    pub free_numbers: Vec<FreeNumber>,
    pub user_licenses: Vec<UserLicense>,
    pub subscriptions: Vec<Subscription>,
    pub call_queues: Vec<CallQueue>,
    pub auto_attendants: Vec<AutoAttendant>,
    pub resource_accounts: Vec<ResourceAccount>,
    pub orphan_licenses: Vec<OrphanLicense>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
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

async fn fetch_pages(client: &Client, token: &str, url: &str) -> Result<Vec<Value>, String> {
    let mut items = Vec::new();
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
            let st = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("HTTP {st} depuis {u}: {body}"));
        }

        let json: Value = resp.json().await.map_err(|e| e.to_string())?;
        if let Some(arr) = json.get("value").and_then(|v| v.as_array()) {
            items.extend(arr.clone());
        }
        next = json.get("@odata.nextLink").and_then(|v| v.as_str()).map(|s| s.to_string());
    }

    Ok(items)
}

fn str_val(v: &Value, key: &str) -> String {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("").to_string()
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
    matches!(sku, "MCOEV" | "MCOEV_VIRTUALUSER" | "MCOPSTN1" | "MCOPSTN2" | "MCOPSTN_5" | "MCOPSTNC" | "PHONESYSTEM_VIRTUALUSER")
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

fn normalize_phone(value: &str) -> String {
    value.trim().replace(' ', "")
}

fn lower(value: &str) -> String {
    value.to_lowercase()
}

fn is_free_subscription_sku(sku: &str) -> bool {
    let upper = sku.to_uppercase();
    upper.contains("FREE")
        || upper.contains("EXPLORATORY")
        || matches!(upper.as_str(), "MCOEV_VIRTUALUSER" | "TEAMS_PHONE_RESOURCE_ACCOUNT")
}

fn compute_subscription_status(available: i64, is_free: bool) -> String {
    if available < 0 {
        "DEPASSEMENT".into()
    } else if is_free {
        "OK".into()
    } else if available <= 1 {
        "OK".into()
    } else if available <= 4 {
        "SURPLUS".into()
    } else {
        "SURPLUS IMPORTANT".into()
    }
}

fn detect_resource_account_type(display_name: &str, upn: &str, license_skus: &[String]) -> Option<String> {
    let name = lower(display_name);
    let upn_lower = lower(upn);
    let has_virtual_license = license_skus.iter().any(|s| s == "MCOEV_VIRTUALUSER");

    let is_aa = name.contains("auto attendant") || name.starts_with("aa-") || name.starts_with("aa ") || upn_lower.contains("autoattendant");
    if is_aa {
        return Some("Auto Attendant".into());
    }

    let is_cq = name.contains("call queue") || name.starts_with("cq-") || name.starts_with("cq ") || upn_lower.contains("callqueue");
    if is_cq {
        return Some("Call Queue".into());
    }

    if has_virtual_license {
        return Some("Compte ressource".into());
    }

    None
}

fn sort_case_insensitive_by<T, F>(items: &mut [T], key: F)
where
    F: Fn(&T) -> &str,
{
    items.sort_by(|a, b| lower(key(a)).cmp(&lower(key(b))));
}

fn merge_resource_based_queues(data: &mut DashboardData) {
    let existing: std::collections::HashSet<String> = data.call_queues.iter().map(|q| lower(&q.name)).collect();
    for ra in data.resource_accounts.iter().filter(|r| r.account_type == "Call Queue") {
        if !existing.contains(&lower(&ra.display_name)) {
            data.call_queues.push(CallQueue {
                name: ra.display_name.clone(),
                language: "N/A".into(),
                routing_method: "N/A".into(),
                agent_count: 0,
                timeout_action: "N/A".into(),
                overflow_action: "N/A".into(),
                phone_number: ra.phone_number.clone(),
            });
        }
    }
}

fn merge_resource_based_attendants(data: &mut DashboardData) {
    let existing: std::collections::HashSet<String> = data.auto_attendants.iter().map(|q| lower(&q.name)).collect();
    for ra in data.resource_accounts.iter().filter(|r| r.account_type == "Auto Attendant") {
        if !existing.contains(&lower(&ra.display_name)) {
            data.auto_attendants.push(AutoAttendant {
                name: ra.display_name.clone(),
                language: "N/A".into(),
                time_zone: "N/A".into(),
                phone_number: ra.phone_number.clone(),
                status: "Actif".into(),
            });
        }
    }
}

pub async fn collect_all(client: &Client, token: &str) -> DashboardData {
    let mut data = DashboardData::default();
    let mut sku_id_map: std::collections::HashMap<String, String> = Default::default();
    let mut assigned_numbers_by_target: std::collections::HashMap<String, Vec<String>> = Default::default();

    match fetch_pages(client, token, &format!("{V1}/subscribedSkus")).await {
        Err(e) => data.errors.push(format!("Abonnements : {e}")),
        Ok(skus) => {
            for s in &skus {
                let id = str_val(s, "skuId");
                let part = str_val(s, "skuPartNumber");
                if !id.is_empty() {
                    sku_id_map.insert(id, part.clone());
                }

                let enabled = s.get("prepaidUnits").and_then(|u| u.get("enabled")).and_then(|v| v.as_i64()).unwrap_or(0);
                let suspended = s.get("prepaidUnits").and_then(|u| u.get("suspended")).and_then(|v| v.as_i64()).unwrap_or(0);
                let consumed = i64_val(s, "consumedUnits");
                let available = enabled - consumed;
                let sku = str_val(s, "skuPartNumber");
                let is_free = is_free_subscription_sku(&sku);

                data.subscriptions.push(Subscription {
                    friendly_name: friendly_sku(&sku).to_string(),
                    sku,
                    purchased: enabled,
                    suspended,
                    consumed,
                    available,
                    status: compute_subscription_status(available, is_free),
                    is_free,
                });
            }
        }
    }

    match fetch_pages(client, token, &format!("{BETA}/admin/teams/telephoneNumberManagement/numberAssignments?$top=999")).await {
        Err(e) => {
            data.warnings.push(format!("Inventaire des numéros Teams indisponible via l'API numberAssignments ({e}). Repli partiel sur les données utilisateur."));
        }
        Ok(assignments) => {
            for n in assignments {
                let telephone_number = str_val(&n, "telephoneNumber");
                let assignment_target_id = str_val(&n, "assignmentTargetId");
                let assignment_status = str_val(&n, "assignmentStatus");
                let capabilities = str_array(&n, "capabilities");

                if !assignment_target_id.is_empty() && !telephone_number.is_empty() && assignment_status != "unassigned" {
                    assigned_numbers_by_target.entry(assignment_target_id).or_default().push(telephone_number.clone());
                }

                if assignment_status == "unassigned" && capabilities.iter().any(|c| c == "userAssignment") {
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

    let user_url = format!("{V1}/users?$select=id,displayName,userPrincipalName,businessPhones,assignedLicenses,accountEnabled,usageLocation&$top=999");
    match fetch_pages(client, token, &user_url).await {
        Err(e) => data.errors.push(format!("Utilisateurs : {e}")),
        Ok(users) => {
            for u in &users {
                let user_id = str_val(u, "id");
                let upn = str_val(u, "userPrincipalName");
                let name = str_val(u, "displayName");
                let enabled = bool_val(u, "accountEnabled");
                let location = str_val(u, "usageLocation");

                let lic_skus: Vec<String> = u
                    .get("assignedLicenses")
                    .and_then(|l| l.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|l| l.get("skuId")?.as_str())
                            .filter_map(|id| sku_id_map.get(id))
                            .cloned()
                            .collect()
                    })
                    .unwrap_or_default();

                let assigned_phones = assigned_numbers_by_target.get(&user_id).cloned().unwrap_or_default();
                let business_phones = str_array(u, "businessPhones");
                let phones = if !assigned_phones.is_empty() { assigned_phones.clone() } else { business_phones };

                let license_names = lic_skus.iter().map(|s| friendly_sku(s).to_string()).collect::<Vec<_>>();
                let phone_license_names = lic_skus.iter().filter(|s| is_phone_related_sku(s)).map(|s| friendly_sku(s).to_string()).collect::<Vec<_>>();
                let phone_number_display = if phones.is_empty() { "-".into() } else { dedup_keep_order(phones.clone()).join(", ") };

                for sku in &lic_skus {
                    data.user_licenses.push(UserLicense {
                        display_name: name.clone(),
                        upn: upn.clone(),
                        sku_part_number: sku.clone(),
                        friendly_name: friendly_sku(sku).to_string(),
                        account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                    });
                }

                data.directory_users.push(DirectoryUser {
                    display_name: name.clone(),
                    upn: upn.clone(),
                    account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                    usage_location: location,
                    licenses: license_names.join(", "),
                    phone_number: phone_number_display.clone(),
                    has_phone_license: if phone_license_names.is_empty() { "Non".into() } else { "Oui".into() },
                });

                if !assigned_phones.is_empty() {
                    let phone_licenses = lic_skus
                        .iter()
                        .filter(|s| is_phone_related_sku(s))
                        .map(|s| friendly_sku(s).to_string())
                        .collect::<Vec<_>>()
                        .join(", ");

                    data.phone_users.push(PhoneUser {
                        display_name: name.clone(),
                        upn: upn.clone(),
                        phone_number: phone_number_display.clone(),
                        ev_enabled: if lic_skus.iter().any(|s| is_phone_related_sku(s)) { "Oui".into() } else { "Non".into() },
                        account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                        usage_location: String::new(),
                        licenses: phone_licenses,
                    });
                }

                if let Some(account_type) = detect_resource_account_type(&name, &upn, &lic_skus) {
                    data.resource_accounts.push(ResourceAccount {
                        display_name: name.clone(),
                        upn: upn.clone(),
                        account_type,
                        phone_number: phone_number_display,
                        licensed: if lic_skus.iter().any(|s| s == "MCOEV_VIRTUALUSER") { "Oui".into() } else { "Non".into() },
                    });
                }

                let has_teams_number = !assigned_phones.is_empty();
                let phone_lics: Vec<String> = lic_skus
                    .iter()
                    .filter(|s| is_phone_related_sku(s) && *s != "MCOEV_VIRTUALUSER")
                    .cloned()
                    .collect();
                if !phone_lics.is_empty() && !has_teams_number && enabled {
                    data.orphan_licenses.push(OrphanLicense {
                        upn: upn.clone(),
                        display_name: name.clone(),
                        licenses: phone_lics.iter().map(|s| friendly_sku(s).to_string()).collect::<Vec<_>>().join(", "),
                        status: "Licence Teams Phone sans numéro Teams affecté".into(),
                    });
                }
            }
        }
    }

    match fetch_pages(client, token, &format!("{BETA}/solutions/businessApplications/callQueues")).await {
        Err(e) => data.warnings.push(format!("Détails des files d'attente indisponibles via Microsoft Graph ({e}). Affichage à partir des comptes ressources détectés.")),
        Ok(cqs) => {
            for q in cqs {
                data.call_queues.push(CallQueue {
                    name: str_val(&q, "displayName"),
                    language: str_val(&q, "languageId"),
                    routing_method: str_val(&q, "routingMethod"),
                    agent_count: i64_val(&q, "agentCount"),
                    timeout_action: str_val(&q, "timeoutAction"),
                    overflow_action: str_val(&q, "overflowAction"),
                    phone_number: q.get("phoneNumbers").and_then(|p| p.as_array()).and_then(|arr| arr.first()).and_then(|v| v.as_str()).unwrap_or("-").to_string(),
                });
            }
        }
    }

    match fetch_pages(client, token, &format!("{BETA}/solutions/businessApplications/autoAttendants")).await {
        Err(e) => data.warnings.push(format!("Détails des standards automatiques indisponibles via Microsoft Graph ({e}). Affichage à partir des comptes ressources détectés.")),
        Ok(aas) => {
            for a in aas {
                data.auto_attendants.push(AutoAttendant {
                    name: str_val(&a, "displayName"),
                    language: str_val(&a, "languageId"),
                    time_zone: str_val(&a, "timeZoneId"),
                    phone_number: a.get("phoneNumbers").and_then(|p| p.as_array()).and_then(|arr| arr.first()).and_then(|v| v.as_str()).unwrap_or("-").to_string(),
                    status: "Actif".into(),
                });
            }
        }
    }

    merge_resource_based_queues(&mut data);
    merge_resource_based_attendants(&mut data);

    let known_resource_numbers: std::collections::HashSet<String> = data
        .resource_accounts
        .iter()
        .flat_map(|r| r.phone_number.split(','))
        .map(normalize_phone)
        .filter(|n| !n.is_empty() && n != "-")
        .collect();
    data.orphan_licenses.retain(|o| {
        let maybe_number = data
            .directory_users
            .iter()
            .find(|u| u.upn == o.upn)
            .map(|u| normalize_phone(&u.phone_number))
            .unwrap_or_default();
        maybe_number.is_empty() || !known_resource_numbers.contains(&maybe_number)
    });

    sort_case_insensitive_by(&mut data.directory_users, |x| &x.display_name);
    sort_case_insensitive_by(&mut data.phone_users, |x| &x.display_name);
    sort_case_insensitive_by(&mut data.free_numbers, |x| &x.number);
    sort_case_insensitive_by(&mut data.user_licenses, |x| &x.display_name);
    sort_case_insensitive_by(&mut data.subscriptions, |x| &x.friendly_name);
    sort_case_insensitive_by(&mut data.call_queues, |x| &x.name);
    sort_case_insensitive_by(&mut data.auto_attendants, |x| &x.name);
    sort_case_insensitive_by(&mut data.resource_accounts, |x| &x.display_name);
    sort_case_insensitive_by(&mut data.orphan_licenses, |x| &x.display_name);

    data
}
