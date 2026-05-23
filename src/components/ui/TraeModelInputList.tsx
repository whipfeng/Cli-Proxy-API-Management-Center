import { Fragment } from 'react';
import { Button } from './Button';
import { IconX } from './icons';
import type { ModelEntry } from '@/components/providers/types';

interface TraeModelInputListProps {
  entries: ModelEntry[];
  onChange: (entries: ModelEntry[]) => void;
  addLabel?: string;
  disabled?: boolean;
  namePlaceholder?: string;
  configNamePlaceholder?: string;
  modelNamePlaceholder?: string;
  hideAddButton?: boolean;
  onAdd?: () => void;
  className?: string;
  rowClassName?: string;
  inputClassName?: string;
  removeButtonClassName?: string;
  removeButtonTitle?: string;
  removeButtonAriaLabel?: string;
}

export function TraeModelInputList({
  entries,
  onChange,
  addLabel,
  disabled = false,
  namePlaceholder = 'client model name',
  configNamePlaceholder = 'config name',
  modelNamePlaceholder = 'model name',
  hideAddButton = false,
  onAdd,
  className = '',
  rowClassName = '',
  inputClassName = '',
  removeButtonClassName = '',
  removeButtonTitle = 'Remove',
  removeButtonAriaLabel = 'Remove',
}: TraeModelInputListProps) {
  const currentEntries = entries.length ? entries : [{ name: '', alias: '', configName: '', modelName: '' }];
  const containerClassName = ['header-input-list', className].filter(Boolean).join(' ');
  const inputClassNames = ['input', inputClassName].filter(Boolean).join(' ');
  const rowClassNames = ['header-input-row', rowClassName].filter(Boolean).join(' ');

  const updateEntry = (index: number, field: 'name' | 'configName' | 'modelName', value: string) => {
    const next = currentEntries.map((entry, idx) => (idx === index ? { ...entry, [field]: value } : entry));
    onChange(next);
  };

  const addEntry = () => {
    if (onAdd) {
      onAdd();
    } else {
      onChange([...currentEntries, { name: '', alias: '', configName: '', modelName: '' }]);
    }
  };

  const removeEntry = (index: number) => {
    const next = currentEntries.filter((_, idx) => idx !== index);
    onChange(next.length ? next : [{ name: '', alias: '', configName: '', modelName: '' }]);
  };

  return (
    <div className={containerClassName}>
      {currentEntries.map((entry, index) => (
        <Fragment key={index}>
          <div className={rowClassNames}>
            <input
              className={inputClassNames}
              placeholder={namePlaceholder}
              value={entry.name}
              onChange={(e) => updateEntry(index, 'name', e.target.value)}
              disabled={disabled}
            />
            <input
              className={inputClassNames}
              placeholder={configNamePlaceholder}
              value={entry.configName ?? ''}
              onChange={(e) => updateEntry(index, 'configName', e.target.value)}
              disabled={disabled}
            />
            <input
              className={inputClassNames}
              placeholder={modelNamePlaceholder}
              value={entry.modelName ?? ''}
              onChange={(e) => updateEntry(index, 'modelName', e.target.value)}
              disabled={disabled}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeEntry(index)}
              disabled={disabled || currentEntries.length <= 1}
              className={removeButtonClassName}
              title={removeButtonTitle}
              aria-label={removeButtonAriaLabel}
            >
              <IconX size={14} />
            </Button>
          </div>
        </Fragment>
      ))}
      {!hideAddButton && addLabel && (
        <Button variant="secondary" size="sm" onClick={addEntry} disabled={disabled} className="align-start">
          {addLabel}
        </Button>
      )}
    </div>
  );
}
