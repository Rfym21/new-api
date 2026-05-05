/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Button,
  Input,
  Popover,
  Typography,
  Space,
  Empty,
  Banner,
} from '@douyinfe/semi-ui';
import { Plus, Trash2, Search } from 'lucide-react';
import {
  getLucideIconByName,
  listLucideIconNames,
} from '../../../helpers/render';
import { API, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it) =>
          it &&
          typeof it === 'object' &&
          typeof it.title === 'string' &&
          typeof it.url === 'string',
      )
      .map((it) => ({
        id: typeof it.id === 'string' && it.id ? it.id : genId(),
        title: it.title,
        url: it.url,
        icon: typeof it.icon === 'string' ? it.icon : '',
        group: typeof it.group === 'string' ? it.group : '',
      }));
  } catch {
    return [];
  }
}

function IconPicker({ value, onChange }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const allNames = useMemo(() => listLucideIconNames(), []);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? allNames.filter((n) => n.toLowerCase().includes(q))
      : allNames;
    return list.slice(0, 240);
  }, [allNames, query]);

  const content = (
    <div style={{ width: 320, padding: 8 }}>
      <Input
        prefix={<Search size={14} />}
        placeholder={t('搜索图标')}
        value={query}
        onChange={(v) => setQuery(v)}
        style={{ marginBottom: 8 }}
      />
      <div
        style={{
          maxHeight: 260,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 4,
        }}
      >
        <Button
          theme={!value ? 'solid' : 'borderless'}
          type='tertiary'
          size='small'
          onClick={() => {
            onChange('');
            setVisible(false);
          }}
          title={t('无图标')}
        >
          —
        </Button>
        {matches.map((name) => (
          <Button
            key={name}
            theme={value === name ? 'solid' : 'borderless'}
            type='tertiary'
            size='small'
            onClick={() => {
              onChange(name);
              setVisible(false);
            }}
            title={name}
          >
            {getLucideIconByName(name, value === name)}
          </Button>
        ))}
      </div>
      {query && matches.length === 0 && (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <Text type='tertiary' size='small'>
            {t('未找到匹配图标')}
          </Text>
        </div>
      )}
      <Text
        type='tertiary'
        size='small'
        style={{ display: 'block', marginTop: 8, fontSize: 10 }}
      >
        {t('最多显示 240 个，输入关键字精筛')}
      </Text>
    </div>
  );

  return (
    <Popover
      trigger='click'
      visible={visible}
      onVisibleChange={setVisible}
      content={content}
      position='bottomLeft'
    >
      <Button
        theme='light'
        type='tertiary'
        size='small'
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {getLucideIconByName(value)}
        <Text size='small' style={{ marginLeft: 4 }}>
          {value || t('无图标')}
        </Text>
      </Button>
    </Popover>
  );
}

export default function SettingsSidebarCustomItems(props) {
  const { t } = useTranslation();
  const [items, setItems] = useState(() =>
    safeParse(props.options?.SidebarCustomItems || '[]'),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(safeParse(props.options?.SidebarCustomItems || '[]'));
  }, [props.options?.SidebarCustomItems]);

  const handleChange = (id, patch) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  };

  const handleAdd = () => {
    setItems((prev) => [
      ...prev,
      { id: genId(), title: '', url: '', icon: '', group: '' },
    ]);
  };

  const handleRemove = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSave = async () => {
    const cleaned = items
      .map((it) => ({
        ...it,
        title: it.title.trim(),
        url: it.url.trim(),
        icon: it.icon ? it.icon.trim() : '',
        group: it.group ? it.group.trim() : '',
      }))
      .filter((it) => it.title && it.url);
    try {
      setSaving(true);
      const res = await API.put('/api/option/', {
        key: 'SidebarCustomItems',
        value: JSON.stringify(cleaned),
      });
      const { success, message } = res.data || {};
      if (success) {
        showSuccess(t('保存成功'));
        setItems(cleaned);
        props.refresh && props.refresh();
      } else {
        showError(message || t('保存失败'));
      }
    } catch (err) {
      showError(err?.message || t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={t('侧栏自定义导航项')}
      headerExtraContent={
        <Space>
          <Button
            icon={<Plus size={14} />}
            theme='borderless'
            type='tertiary'
            onClick={handleAdd}
          >
            {t('添加一项')}
          </Button>
          <Button theme='solid' onClick={handleSave} loading={saving}>
            {t('保存设置')}
          </Button>
        </Space>
      }
    >
      <Banner
        type='info'
        description={t(
          'URL 可填外链 https:// 或内部路径 /xxx；图标从 lucide 全量图标里选；分组缺省落到「自定义」。',
        )}
        style={{ marginBottom: 12 }}
      />

      {items.length === 0 ? (
        <Empty title={t('尚未配置任何自定义项')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item) => (
            <Form
              key={item.id}
              layout='horizontal'
              style={{
                border: '1px solid var(--semi-color-border)',
                borderRadius: 6,
                padding: 12,
              }}
            >
              <Space wrap align='end'>
                <Form.Section>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text size='small' type='tertiary'>{t('标题')}</Text>
                    <Input
                      value={item.title}
                      onChange={(v) => handleChange(item.id, { title: v })}
                      placeholder={t('例如：使用文档')}
                      style={{ width: 180 }}
                    />
                  </div>
                </Form.Section>
                <Form.Section>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text size='small' type='tertiary'>{t('链接')}</Text>
                    <Input
                      value={item.url}
                      onChange={(v) => handleChange(item.id, { url: v })}
                      placeholder='https://example.com/docs'
                      style={{ width: 240 }}
                    />
                  </div>
                </Form.Section>
                <Form.Section>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text size='small' type='tertiary'>{t('分组')}</Text>
                    <Input
                      value={item.group}
                      onChange={(v) => handleChange(item.id, { group: v })}
                      placeholder={t('自定义')}
                      style={{ width: 120 }}
                    />
                  </div>
                </Form.Section>
                <Form.Section>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text size='small' type='tertiary'>{t('图标')}</Text>
                    <IconPicker
                      value={item.icon}
                      onChange={(next) => handleChange(item.id, { icon: next })}
                    />
                  </div>
                </Form.Section>
                <Form.Section>
                  <Button
                    icon={<Trash2 size={14} />}
                    theme='borderless'
                    type='danger'
                    onClick={() => handleRemove(item.id)}
                  >
                    {t('删除')}
                  </Button>
                </Form.Section>
              </Space>
            </Form>
          ))}
        </div>
      )}
    </Card>
  );
}
