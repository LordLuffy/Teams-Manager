// Types exposés par le backend Rust vers le frontend React.

export interface AppConfig {
  tenant_id: string;
  client_id: string;
  client_secret?: string;
}

export interface DeviceCodeResult {
  user_code: string;
  verification_uri: string;
  message: string;
  interval: number;
  device_code: string;
}

export interface PhoneUser {
  displayName: string;
  upn: string;
  phoneNumber: string;
  evEnabled: string;
  accountEnabled: string;
  usageLocation: string;
  licenses: string;
}

export interface FreeNumber {
  number: string;
  numberType: string;
  city: string;
  country: string;
  capability: string;
  status: string;
}

export interface UserLicense {
  displayName: string;
  upn: string;
  skuPartNumber: string;
  friendlyName: string;
  accountEnabled: string;
}

export interface Subscription {
  friendlyName: string;
  sku: string;
  purchased: number;
  suspended: number;
  consumed: number;
  available: number;
  status: string;
  isFree: boolean;
}

export interface CallQueue {
  name: string;
  language: string;
  routingMethod: string;
  agentCount: number;
  timeoutAction: string;
  overflowAction: string;
  phoneNumber: string;
  canBeDeleted: string;
}

export interface AutoAttendant {
  name: string;
  language: string;
  timeZone: string;
  phoneNumber: string;
  status: string;
  canBeDeleted: string;
}

export interface ResourceAccount {
  displayName: string;
  upn: string;
  accountType: string;
  phoneNumber: string;
  licensed: string;
}

export interface OrphanLicense {
  upn: string;
  displayName: string;
  licenses: string;
  status: string;
}

export interface DirectoryUser {
  displayName: string;
  upn: string;
  accountEnabled: string;
  usageLocation: string;
  licenses: string;
  phoneNumber: string;
  hasPhoneLicense: string;
}

export interface DashboardData {
  directoryUsers: DirectoryUser[];
  phoneUsers: PhoneUser[];
  freeNumbers: FreeNumber[];
  userLicenses: UserLicense[];
  subscriptions: Subscription[];
  callQueues: CallQueue[];
  autoAttendants: AutoAttendant[];
  resourceAccounts: ResourceAccount[];
  orphanLicenses: OrphanLicense[];
  errors: string[];
  warnings: string[];
}

export type TabId =
  | "directoryUsers"
  | "phoneUsers"
  | "freeNumbers"
  | "orphanLicenses"
  | "userLicenses"
  | "subscriptions"
  | "callQueues"
  | "autoAttendants"
  | "resourceAccounts";

export type AppScreen = "setup" | "auth" | "dashboard";
