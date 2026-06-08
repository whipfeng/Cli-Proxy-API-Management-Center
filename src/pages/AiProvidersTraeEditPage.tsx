import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HeaderInputList } from '@/components/ui/HeaderInputList';
import { TraeModelInputList } from '@/components/ui/TraeModelInputList';
import { modelsToEntries } from '@/components/ui/modelInputListUtils';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { SecondaryScreenShell } from '@/components/common/SecondaryScreenShell';
import { providersApi } from '@/services/api';
import { useAuthStore, useConfigStore, useNotificationStore } from '@/stores';
import type { ModelAlias, ProviderKeyConfig } from '@/types';
import { excludedModelsToText, parseExcludedModels } from '@/components/providers/utils';
import { buildHeaderObject, headersToEntries, normalizeHeaderEntries } from '@/utils/headers';
import { areKeyValueEntriesEqual, areModelEntriesEqual, areStringArraysEqual } from '@/utils/compare';
import type { ProviderFormState } from '@/components/providers';
import styles from './AiProvidersPage.module.scss';
import layoutStyles from './AiProvidersEditLayout.module.scss';

type LocationState = { fromAiProviders?: boolean } | null;

const DEFAULT_TRAE_BASE_URL = 'https://console.enterprise.trae.cn';

const buildEmptyForm = (): ProviderFormState => ({
  name: '',
  apiKey: '',
  priority: undefined,
  prefix: '',
  baseUrl: DEFAULT_TRAE_BASE_URL,
  proxyUrl: '',
  headers: [],
  models: [],
  excludedModels: [],
  modelEntries: [{ name: '', alias: '', displayName: '', configName: '', modelName: '' }],
  excludedText: '',
  refreshToken: '',
});

const parseIndexParam = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeModelEntries = (entries: Array<{ name: string; alias: string; displayName?: string; configName?: string; modelName?: string }>) =>
  (entries ?? []).reduce<Array<{ name: string; alias: string; displayName?: string; configName?: string; modelName?: string }>>((acc, entry) => {
    const name = String(entry?.name ?? '').trim();
    const displayName = String(entry?.displayName ?? '').trim();
    const configName = String(entry?.configName ?? '').trim();
    const modelName = String(entry?.modelName ?? '').trim();
    if (!name && !configName && !modelName) return acc;
    acc.push({ name, alias: name, displayName, configName, modelName });
    return acc;
  }, []);

type TraeFormBaseline = {
  name: string;
  apiKey: string;
  priority: number | null;
  prefix: string;
  baseUrl: string;
  proxyUrl: string;
  headers: ReturnType<typeof normalizeHeaderEntries>;
  models: ReturnType<typeof normalizeModelEntries>;
  excludedModels: string[];
  refreshToken: string;
};

const buildTraeBaseline = (form: ProviderFormState): TraeFormBaseline => ({
  name: String(form.name ?? '').trim(),
  apiKey: String(form.apiKey ?? '').trim(),
  priority:
    form.priority !== undefined && Number.isFinite(form.priority) ? Math.trunc(form.priority) : null,
  prefix: String(form.prefix ?? '').trim(),
  baseUrl: String(form.baseUrl ?? '').trim(),
  proxyUrl: String(form.proxyUrl ?? '').trim(),
  headers: normalizeHeaderEntries(form.headers),
  models: normalizeModelEntries(form.modelEntries),
  excludedModels: parseExcludedModels(form.excludedText ?? ''),
  refreshToken: String(form.refreshToken ?? '').trim(),
});

export function AiProvidersTraeEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ index?: string }>();

  const { showNotification } = useNotificationStore();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const disableControls = connectionStatus !== 'connected';

  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const updateConfigValue = useConfigStore((state) => state.updateConfigValue);
  const clearCache = useConfigStore((state) => state.clearCache);

  const [configs, setConfigs] = useState<ProviderKeyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ProviderFormState>(() => buildEmptyForm());
  const [baseline, setBaseline] = useState(() => buildTraeBaseline(buildEmptyForm()));

  const hasIndexParam = typeof params.index === 'string';
  const editIndex = useMemo(() => parseIndexParam(params.index), [params.index]);
  const invalidIndexParam = hasIndexParam && editIndex === null;

  const initialData = useMemo(() => {
    if (editIndex === null) return undefined;
    return configs[editIndex];
  }, [configs, editIndex]);

  const invalidIndex = editIndex !== null && !initialData;

  const title =
    editIndex !== null
      ? t('ai_providers.trae_edit_modal_title', { defaultValue: '编辑Trae API配置' })
      : t('ai_providers.trae_add_modal_title', { defaultValue: '添加Trae API配置' });

  const handleBack = useCallback(() => {
    const state = location.state as LocationState;
    if (state?.fromAiProviders) {
      navigate(-1);
      return;
    }
    navigate('/ai-providers', { replace: true });
  }, [location.state, navigate]);

  const swipeRef = useEdgeSwipeBack({ onBack: handleBack });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([fetchConfig('trae-api-key'), providersApi.getTraeConfigs()])
      .then(([configResult, traeResult]) => {
        if (cancelled) return;

        const list = Array.isArray(traeResult)
          ? (traeResult as ProviderKeyConfig[])
          : Array.isArray(configResult)
            ? (configResult as ProviderKeyConfig[])
            : [];
        setConfigs(list);
        updateConfigValue('trae-api-key', list);
        clearCache('trae-api-key');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '';
        setError(message || t('notification.refresh_failed'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clearCache, fetchConfig, t, updateConfigValue]);

  useEffect(() => {
    if (loading) return;

    if (initialData) {
      const nextForm: ProviderFormState = {
        ...initialData,
        baseUrl: initialData.baseUrl || DEFAULT_TRAE_BASE_URL,
        headers: headersToEntries(initialData.headers),
        modelEntries: modelsToEntries(initialData.models),
        excludedText: excludedModelsToText(initialData.excludedModels),
        refreshToken: initialData.refreshToken || '',
      };
      setForm(nextForm);
      setBaseline(buildTraeBaseline(nextForm));
      return;
    }
    const nextForm = buildEmptyForm();
    setForm(nextForm);
    setBaseline(buildTraeBaseline(nextForm));
  }, [initialData, loading]);

  const canSave = !disableControls && !saving && !loading && !invalidIndexParam && !invalidIndex;

  const normalizedHeaders = useMemo(() => normalizeHeaderEntries(form.headers), [form.headers]);
  const normalizedModels = useMemo(
    () => normalizeModelEntries(form.modelEntries),
    [form.modelEntries]
  );
  const normalizedExcludedModels = useMemo(
    () => parseExcludedModels(form.excludedText ?? ''),
    [form.excludedText]
  );
  const normalizedPriority = useMemo(() => {
    return form.priority !== undefined && Number.isFinite(form.priority)
      ? Math.trunc(form.priority)
      : null;
  }, [form.priority]);
  const isHeadersDirty = useMemo(
    () => !areKeyValueEntriesEqual(baseline.headers, normalizedHeaders),
    [baseline.headers, normalizedHeaders]
  );
  const isModelsDirty = useMemo(
    () => !areModelEntriesEqual(baseline.models, normalizedModels),
    [baseline.models, normalizedModels]
  );
  const isExcludedModelsDirty = useMemo(
    () => !areStringArraysEqual(baseline.excludedModels, normalizedExcludedModels),
    [baseline.excludedModels, normalizedExcludedModels]
  );
  const isDirty =
    baseline.name !== String(form.name ?? '').trim() ||
    baseline.apiKey !== form.apiKey.trim() ||
    baseline.priority !== normalizedPriority ||
    baseline.prefix !== String(form.prefix ?? '').trim() ||
    baseline.baseUrl !== String(form.baseUrl ?? '').trim() ||
    baseline.proxyUrl !== String(form.proxyUrl ?? '').trim() ||
    baseline.refreshToken !== String(form.refreshToken ?? '').trim() ||
    isHeadersDirty ||
    isModelsDirty ||
    isExcludedModelsDirty;
  const canGuard = !loading && !saving && !invalidIndexParam && !invalidIndex;

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testModelIndex, setTestModelIndex] = useState(0);
  const [importing, setImporting] = useState(false);

  const validModels = useMemo(
    () => form.modelEntries.filter((e) => e.name.trim() && e.configName?.trim() && e.modelName?.trim()),
    [form.modelEntries]
  );

  useEffect(() => {
    if (testModelIndex >= validModels.length) {
      setTestModelIndex(0);
    }
  }, [validModels.length, testModelIndex]);

  const runTest = useCallback(async () => {
    if (testStatus === 'loading') return;
    const baseUrl = (form.baseUrl ?? '').trim() || DEFAULT_TRAE_BASE_URL;
    const rawApiKey = form.apiKey.trim();
    // Treat placeholder as empty for test purposes
    const apiKey = rawApiKey === '__TRAE_REFRESH_TOKEN_ONLY__' ? '' : rawApiKey;
    const refreshToken = (form.refreshToken ?? '').trim();
    if (!apiKey && !refreshToken) {
      setTestStatus('error');
      setTestMessage(t('notification.trae_test_key_required', { defaultValue: 'API密钥不能为空' }));
      return;
    }
    if (validModels.length === 0) {
      setTestStatus('error');
      setTestMessage(
        t('ai_providers.trae_test_model_required', {
          defaultValue: '请至少填写一个完整的模型配置（名称、config name、model name）',
        })
      );
      return;
    }
    const idx = testModelIndex >= 0 && testModelIndex < validModels.length ? testModelIndex : 0;
    const selected = validModels[idx];
    const configName = selected.configName!.trim();
    const modelName = selected.modelName!.trim();
    const testModelName = selected.name.trim();

    setTestStatus('loading');
    setTestMessage(t('ai_providers.trae_test_running', { defaultValue: '测试中...' }));
    try {
      const result = (await providersApi.testTraeKey({ baseUrl, apiKey, refreshToken: refreshToken || undefined, configName, modelName })) as {
        success: boolean;
        message?: string;
      };
      const modelInfo = `[${testModelName}] config=${configName} model=${modelName}`;
      if (result.success) {
        setTestStatus('success');
        setTestMessage(
          `${result.message || t('ai_providers.trae_test_success', { defaultValue: '连接成功' })} ${modelInfo}`
        );
      } else {
        setTestStatus('error');
        setTestMessage(
          `${result.message || t('ai_providers.trae_test_failed', { defaultValue: '连接失败' })} ${modelInfo}`
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setTestStatus('error');
      setTestMessage(message || t('ai_providers.trae_test_failed', { defaultValue: '连接失败' }));
    }
  }, [form, testStatus, t, validModels, testModelIndex]);

  const handleImportModels = useCallback(async () => {
    const baseUrl = (form.baseUrl ?? '').trim() || DEFAULT_TRAE_BASE_URL;
    const rawApiKey = form.apiKey.trim();
    const apiKey = rawApiKey === '__TRAE_REFRESH_TOKEN_ONLY__' ? '' : rawApiKey;
    const refreshToken = (form.refreshToken ?? '').trim();
    if (!apiKey && !refreshToken) {
      showNotification(
        t('ai_providers.trae_import_key_required', { defaultValue: '请先填写 API 密钥或刷新令牌' }),
        'error'
      );
      return;
    }

    setImporting(true);
    try {
      const result = await providersApi.importTraeModels({ baseUrl, apiKey, refreshToken: refreshToken || undefined });
      if (!result.success || !result.models || result.models.length === 0) {
        showNotification(
          result.message || t('ai_providers.trae_import_failed', { defaultValue: '导入模型列表失败' }),
          'error'
        );
        return;
      }

      // Update apiKey if the server returned a JWT
      if (result.apiKey) {
        setForm((prev) => ({ ...prev, apiKey: result.apiKey! }));
      }

      // Merge imported models: skip duplicates by name
      const newEntries = result.models.map((m) => ({
        name: m.name,
        alias: m.name,
        displayName: m.displayName || '',
        configName: m.configName,
        modelName: m.modelName,
        contextLength: (m as Record<string, unknown>).context_length as number | undefined,
      }));
      setForm((prev) => {
        const existingNames = new Set(prev.modelEntries.map((e) => e.name.trim()).filter(Boolean));
        const toAdd = newEntries.filter((e) => !existingNames.has(e.name));
        const merged = prev.modelEntries.some((e) => !e.name.trim() && !e.configName?.trim() && !e.modelName?.trim())
          ? [...prev.modelEntries.filter((e) => e.name.trim() || e.configName?.trim() || e.modelName?.trim()), ...toAdd]
          : [...prev.modelEntries, ...toAdd];
        return { ...prev, modelEntries: merged.length ? merged : [{ name: '', alias: '', displayName: '', configName: '', modelName: '' }] };
      });
      showNotification(
        t('ai_providers.trae_import_success', { defaultValue: `成功导入 ${result.models.length} 个模型` }).replace('${result.models.length}', String(result.models.length)),
        'success'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(
        `${t('ai_providers.trae_import_failed', { defaultValue: '导入模型列表失败' })}: ${message}`,
        'error'
      );
    } finally {
      setImporting(false);
    }
  }, [form, showNotification, t]);

  const { allowNextNavigation } = useUnsavedChangesGuard({
    enabled: canGuard,
    shouldBlock: ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
    dialog: {
      title: t('common.unsaved_changes_title'),
      message: t('common.unsaved_changes_message'),
      confirmText: t('common.leave'),
      cancelText: t('common.stay'),
      variant: 'danger',
    },
  });

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    const trimmedBaseUrl = (form.baseUrl ?? '').trim();
    const baseUrl = trimmedBaseUrl || undefined;

    setSaving(true);
    setError('');
    try {
      const payload: ProviderKeyConfig = {
        name: form.name?.trim() || undefined,
        apiKey: form.apiKey.trim(),
        priority:
          form.priority !== undefined && Number.isFinite(form.priority)
            ? Math.trunc(form.priority)
            : undefined,
        prefix: form.prefix?.trim() || undefined,
        baseUrl,
        proxyUrl: form.proxyUrl?.trim() || undefined,
        headers: buildHeaderObject(form.headers),
        models: form.modelEntries
          .map((entry) => {
            const name = entry.name.trim();
            const displayName = String(entry.displayName ?? '').trim();
            const configName = String(entry.configName ?? '').trim();
            const modelName = String(entry.modelName ?? '').trim();
            if (!name && !configName && !modelName) return null;
            const model: ModelAlias = { name };
            if (displayName) model.displayName = displayName;
            if (configName) model.configName = configName;
            if (modelName) model.modelName = modelName;
            return model;
          })
          .filter(Boolean) as ProviderKeyConfig['models'],
        excludedModels: parseExcludedModels(form.excludedText),
        refreshToken: (form.refreshToken ?? '').trim() || undefined,
      };

      const nextList =
        editIndex !== null
          ? configs.map((item, idx) => (idx === editIndex ? payload : item))
          : [...configs, payload];

      await providersApi.saveTraeConfigs(nextList);
      updateConfigValue('trae-api-key', nextList);
      clearCache('trae-api-key');
      showNotification(
        editIndex !== null
          ? t('notification.trae_config_updated', { defaultValue: 'Trae配置更新成功' })
          : t('notification.trae_config_added', { defaultValue: 'Trae配置添加成功' }),
        'success'
      );
      allowNextNavigation();
      setBaseline(buildTraeBaseline(form));
      handleBack();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(message);
      showNotification(`${t('notification.update_failed')}: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [
    allowNextNavigation,
    canSave,
    clearCache,
    configs,
    editIndex,
    form,
    handleBack,
    showNotification,
    t,
    updateConfigValue,
  ]);

  return (
    <SecondaryScreenShell
      ref={swipeRef}
      contentClassName={layoutStyles.content}
      title={title}
      onBack={handleBack}
      backLabel={t('common.back')}
      backAriaLabel={t('common.back')}
      hideTopBarBackButton
      hideTopBarRightAction
      floatingAction={
        <div className={layoutStyles.floatingActions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBack}
            className={layoutStyles.floatingBackButton}
          >
            {t('common.back')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!canSave}
            className={layoutStyles.floatingSaveButton}
          >
            {t('common.save')}
          </Button>
        </div>
      }
      isLoading={loading}
      loadingLabel={t('common.loading')}
    >
      <Card>
        {error && <div className="error-box">{error}</div>}
        {invalidIndexParam || invalidIndex ? (
          <div className="hint">{t('common.invalid_provider_index')}</div>
        ) : (
          <>
            <Input
              label={t('ai_providers.config_name_label', { defaultValue: '名称:' })}
              placeholder={t('ai_providers.config_name_placeholder', { defaultValue: '可选，用于区分多个配置' })}
              value={form.name ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              disabled={disableControls || saving}
            />
            <Input
              label={t('ai_providers.trae_add_modal_key_label', { defaultValue: 'API密钥:' })}
              placeholder={t('ai_providers.trae_add_modal_key_placeholder', { defaultValue: '请输入Trae API密钥' })}
              value={form.apiKey}
              onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
              disabled={disableControls || saving}
            />
            <Input
              label={t('ai_providers.priority_label')}
              placeholder={t('ai_providers.priority_hint')}
              type="number"
              step={1}
              value={form.priority ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = raw.trim() === '' ? undefined : Number(raw);
                setForm((prev) => ({
                  ...prev,
                  priority: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
                }));
              }}
              disabled={disableControls || saving}
            />
            <Input
              label={t('ai_providers.prefix_label')}
              placeholder={t('ai_providers.prefix_placeholder')}
              value={form.prefix ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, prefix: e.target.value }))}
              hint={t('ai_providers.prefix_hint')}
              disabled={disableControls || saving}
            />
            <Input
              label={t('ai_providers.trae_add_modal_url_label', { defaultValue: 'Base URL:' })}
              placeholder={t('ai_providers.trae_add_modal_url_placeholder', { defaultValue: '例如: https://api.example.com' })}
              value={form.baseUrl ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
              disabled={disableControls || saving}
            />
            <Input
              label={t('ai_providers.trae_add_modal_proxy_label', { defaultValue: '代理 URL (可选):' })}
              placeholder={t('ai_providers.trae_add_modal_proxy_placeholder', { defaultValue: '例如: socks5://proxy.example.com:1080' })}
              value={form.proxyUrl ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, proxyUrl: e.target.value }))}
              disabled={disableControls || saving}
            />
            <Input
              label="CLI 登录令牌:"
              placeholder="请输入 CLI 登录令牌 (refresh token)"
              value={form.refreshToken ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, refreshToken: e.target.value }))}
              disabled={disableControls || saving}
            />
            <HeaderInputList
              entries={form.headers}
              onChange={(entries) => setForm((prev) => ({ ...prev, headers: entries }))}
              addLabel={t('common.custom_headers_add')}
              keyPlaceholder={t('common.custom_headers_key_placeholder')}
              valuePlaceholder={t('common.custom_headers_value_placeholder')}
              removeButtonTitle={t('common.delete')}
              removeButtonAriaLabel={t('common.delete')}
              disabled={disableControls || saving}
            />
            <div className="form-group">
              <div className={styles.modelConfigHeader}>
                <label className={styles.modelConfigTitle}>{t('ai_providers.trae_models_label', { defaultValue: '自定义模型 (可选):' })}</label>
                <div className={styles.modelConfigToolbar}>
                  {validModels.length > 1 && (
                    <select
                      className="input"
                      style={{ width: 'auto', minWidth: 120, marginRight: 8 }}
                      value={testModelIndex}
                      onChange={(e) => setTestModelIndex(Number(e.target.value))}
                      disabled={disableControls || saving || testStatus === 'loading'}
                    >
                      {validModels.map((m, i) => (
                        <option key={i} value={i}>
                          {m.name.trim()}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    variant={testStatus === 'error' ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={() => void runTest()}
                    loading={testStatus === 'loading'}
                    disabled={disableControls || saving || testStatus === 'loading' || (!form.apiKey.trim() && !String(form.refreshToken ?? '').trim())}
                  >
                    {t('ai_providers.trae_test_action', { defaultValue: '测试连接' })}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleImportModels()}
                    loading={importing}
                    disabled={disableControls || saving || importing || (!form.apiKey.trim() && !String(form.refreshToken ?? '').trim())}
                    style={{ marginLeft: 8 }}
                  >
                    {t('ai_providers.trae_import_action', { defaultValue: '导入模型' })}
                  </Button>
                </div>
              </div>
              {testMessage && (
                <div className={`status-badge ${testStatus === 'error' ? 'error' : testStatus === 'success' ? 'success' : 'muted'}`}>
                  {testMessage}
                </div>
              )}
              <div className={styles.sectionHint}>{t('ai_providers.trae_models_hint', { defaultValue: '客户端模型名 | Display Name | Config Name | Model Name' })}</div>
              <TraeModelInputList
                entries={form.modelEntries}
                onChange={(entries) => setForm((prev) => ({ ...prev, modelEntries: entries }))}
                addLabel={t('ai_providers.trae_models_add_btn', { defaultValue: '添加模型' })}
                namePlaceholder={t('common.model_name_placeholder')}
                displayNamePlaceholder={t('ai_providers.trae_display_name_placeholder', { defaultValue: 'display name' })}
                configNamePlaceholder={t('ai_providers.trae_config_name_placeholder', { defaultValue: 'config name' })}
                modelNamePlaceholder={t('ai_providers.trae_model_name_placeholder', { defaultValue: 'model name' })}
                removeButtonTitle={t('common.delete')}
                removeButtonAriaLabel={t('common.delete')}
                disabled={disableControls || saving}
              />
            </div>
            <div className="form-group">
              <label>{t('ai_providers.excluded_models_label')}</label>
              <textarea
                className="input"
                placeholder={t('ai_providers.excluded_models_placeholder')}
                value={form.excludedText}
                onChange={(e) => setForm((prev) => ({ ...prev, excludedText: e.target.value }))}
                rows={4}
                disabled={disableControls || saving}
              />
              <div className="hint">{t('ai_providers.excluded_models_hint')}</div>
            </div>
          </>
        )}
      </Card>
    </SecondaryScreenShell>
  );
}
