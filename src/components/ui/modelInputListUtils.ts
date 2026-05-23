import type { ModelAlias } from '@/types';

export interface ModelEntry {
  name: string;
  alias: string;
  configName?: string;
  modelName?: string;
}

export const modelsToEntries = (models?: ModelAlias[]): ModelEntry[] => {
  if (!Array.isArray(models) || models.length === 0) {
    return [{ name: '', alias: '' }];
  }
  return models.map((model) => ({
    name: model.name || '',
    alias: model.alias || '',
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
      if (configName) {
        model.configName = configName;
      }
      if (modelName) {
        model.modelName = modelName;
      }
      return model;
    });
};
