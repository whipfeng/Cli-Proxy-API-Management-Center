import type { ModelAlias } from '@/types';

export interface ModelEntry {
  name: string;
  alias: string;
  displayName?: string;
  configName?: string;
  modelName?: string;
  contextLength?: number;
}

export const modelsToEntries = (models?: ModelAlias[]): ModelEntry[] => {
  if (!Array.isArray(models) || models.length === 0) {
    return [{ name: '', alias: '' }];
  }
  return models.map((model) => ({
    name: model.name || '',
    alias: model.alias || '',
    displayName: model.displayName || '',
    configName: model.configName || '',
    modelName: model.modelName || '',
  }));
};

export const entriesToModels = (entries: ModelEntry[]): ModelAlias[] => {
  return entries
    .filter((entry) => entry.name.trim())
    .map((entry) => {
      const model: ModelAlias = { name: entry.name.trim() };
      const alias = entry.alias.trim();
      if (alias && alias !== model.name) {
        model.alias = alias;
      }
      const configName = entry.configName?.trim();
      const modelName = entry.modelName?.trim();
      const displayName = entry.displayName?.trim();
      if (configName) {
        model.configName = configName;
      }
      if (displayName) {
        model.displayName = displayName;
      }
      if (modelName) {
        model.modelName = modelName;
      }
      return model;
    });
};
