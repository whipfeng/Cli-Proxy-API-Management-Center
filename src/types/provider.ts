/**
 * AI 提供商相关类型
 * 基于原项目 src/modules/ai-providers.js
 */

export interface ModelAlias {
  name: string;
  alias?: string;
  priority?: number;
  testModel?: string;
  displayName?: string;
  configName?: string;
  modelName?: string;
  contextLength?: number;
}

export interface ApiKeyEntry {
  apiKey: string;
  proxyUrl?: string;
  headers?: Record<string, string>;
  authIndex?: string;
}

export interface CloakConfig {
  mode?: string;
  strictMode?: boolean;
  sensitiveWords?: string[];
}

export interface GeminiKeyConfig {
  apiKey: string;
  priority?: number;
  prefix?: string;
  baseUrl?: string;
  proxyUrl?: string;
  models?: ModelAlias[];
  headers?: Record<string, string>;
  excludedModels?: string[];
  authIndex?: string;
}

export interface ProviderKeyConfig {
  name?: string;
  apiKey: string;
  priority?: number;
  prefix?: string;
  baseUrl?: string;
  websockets?: boolean;
  proxyUrl?: string;
  headers?: Record<string, string>;
  models?: ModelAlias[];
  excludedModels?: string[];
  cloak?: CloakConfig;
  authIndex?: string;
  refreshToken?: string;
  healthStatus?: {
    overall: 'healthy' | 'degraded' | 'unhealthy' | 'cooldown' | 'disabled';
    is_available: boolean;
    cooldown_until?: string;
    cooldown_remaining?: string;
    unavailable_models?: number;
    total_models?: number;
    quota_limited?: boolean;
  };
  lastError?: { code: number; message: string; time: string };
  quota?: { exceeded: boolean; reason?: string; next_recover_at?: string; backoff_level?: number };
}

export interface OpenAIProviderConfig {
  name: string;
  prefix?: string;
  baseUrl: string;
  apiKeyEntries: ApiKeyEntry[];
  disabled?: boolean;
  headers?: Record<string, string>;
  models?: ModelAlias[];
  priority?: number;
  testModel?: string;
  authIndex?: string;
  [key: string]: unknown;
}
