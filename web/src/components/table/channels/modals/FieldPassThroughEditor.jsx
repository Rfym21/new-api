/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef, useState } from 'react';
import {
  Tabs,
  TabPane,
  Button,
  Input,
  Switch,
  Space,
  TextArea,
} from '@douyinfe/semi-ui';
import { IconDelete, IconPlus } from '@douyinfe/semi-icons';

/**
 * FieldPassThroughEditor 字段透传白名单编辑器。
 * 支持「可视化」与「JSON」双模式编辑；规则结构：{ field, enabled, comment }。
 *
 * @param {object} props
 * @param {string} props.label 标题
 * @param {string} [props.extraText] 说明文案
 * @param {string} [props.placeholder] 字段名输入提示
 * @param {Array<{field:string,enabled:boolean,comment:string}>} props.rules 当前规则数组
 * @param {string} props.text JSON 文本副本（用于 JSON 模式编辑）
 * @param {(rules: Array) => void} props.onChangeRules 规则数组变更回调
 * @param {(text: string) => void} props.onChangeText JSON 文本变更回调
 * @param {Array<{field:string,enabled:boolean,comment:string}>} [props.examples] 示例值，初次为空时显示填充按钮
 * @param {(key: string, opts?: object) => string} props.t i18n 函数
 */
const FieldPassThroughEditor = ({
  label,
  extraText,
  placeholder,
  rules,
  text,
  onChangeRules,
  onChangeText,
  examples = [],
  t,
}) => {
  const [activeTab, setActiveTab] = useState('visual');
  const [jsonError, setJsonError] = useState('');
  const lastSyncedFromRulesRef = useRef('');

  /** 把规则数组同步成 JSON 文本（供 JSON 标签页显示） */
  useEffect(() => {
    const next = JSON.stringify(rules || [], null, 2);
    if (next !== text) {
      lastSyncedFromRulesRef.current = next;
      onChangeText(next);
    }
  }, [rules]);

  const updateRule = (index, patch) => {
    const next = (rules || []).slice();
    next[index] = { ...next[index], ...patch };
    onChangeRules(next);
  };

  const addRule = () => {
    onChangeRules([
      ...(rules || []),
      { field: '', enabled: true, comment: '' },
    ]);
  };

  const removeRule = (index) => {
    const next = (rules || []).slice();
    next.splice(index, 1);
    onChangeRules(next);
  };

  const fillExamples = () => {
    onChangeRules(examples.map((r) => ({ ...r })));
  };

  const handleJsonChange = (value) => {
    onChangeText(value);
    if (!value || !value.trim()) {
      setJsonError('');
      onChangeRules([]);
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        setJsonError(t('JSON 必须是数组'));
        return;
      }
      const normalized = parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          field: typeof item.field === 'string' ? item.field : '',
          enabled: item.enabled === true,
          comment: typeof item.comment === 'string' ? item.comment : '',
        }));
      setJsonError('');
      onChangeRules(normalized);
    } catch (err) {
      setJsonError(t('JSON 解析失败：') + (err?.message || ''));
    }
  };

  return (
    <div className='mb-4'>
      <div className='mb-1 text-sm font-medium'>{label}</div>
      {extraText ? (
        <div className='text-xs text-gray-500 mb-2'>{extraText}</div>
      ) : null}
      <Tabs
        type='line'
        size='small'
        activeKey={activeTab}
        onChange={setActiveTab}
      >
        <TabPane tab={t('可视化编辑')} itemKey='visual'>
          <div className='flex flex-col gap-2'>
            {(rules || []).length === 0 ? (
              <div className='py-6 text-center text-xs text-gray-400'>
                <div className='mb-2'>{t('暂无规则，点击下方"新增字段"添加')}</div>
                <Space>
                  <Button size='small' onClick={addRule} icon={<IconPlus />}>
                    {t('新增字段')}
                  </Button>
                  {examples && examples.length > 0 ? (
                    <Button
                      size='small'
                      type='tertiary'
                      onClick={fillExamples}
                    >
                      {t('填充示例')}
                    </Button>
                  ) : null}
                </Space>
              </div>
            ) : (
              <>
                <div className='hidden md:grid grid-cols-12 gap-2 text-xs text-gray-500 px-1'>
                  <div className='col-span-4'>{t('字段名')}</div>
                  <div className='col-span-2'>{t('开关')}</div>
                  <div className='col-span-5'>{t('备注')}</div>
                  <div className='col-span-1'></div>
                </div>
                {rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className='grid grid-cols-12 gap-2 items-center'
                  >
                    <div className='col-span-12 md:col-span-4'>
                      <Input
                        size='small'
                        value={rule.field}
                        placeholder={placeholder}
                        onChange={(value) => updateRule(idx, { field: value })}
                      />
                    </div>
                    <div className='col-span-6 md:col-span-2'>
                      <Switch
                        size='default'
                        checked={rule.enabled === true}
                        checkedText={t('允许')}
                        uncheckedText={t('禁止')}
                        onChange={(value) =>
                          updateRule(idx, { enabled: value })
                        }
                      />
                    </div>
                    <div className='col-span-12 md:col-span-5'>
                      <Input
                        size='small'
                        value={rule.comment}
                        placeholder={t('备注（可选）')}
                        onChange={(value) =>
                          updateRule(idx, { comment: value })
                        }
                      />
                    </div>
                    <div className='col-span-6 md:col-span-1 flex justify-end'>
                      <Button
                        size='small'
                        type='danger'
                        theme='borderless'
                        icon={<IconDelete />}
                        onClick={() => removeRule(idx)}
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <Space>
                    <Button size='small' onClick={addRule} icon={<IconPlus />}>
                      {t('新增字段')}
                    </Button>
                    {examples && examples.length > 0 ? (
                      <Button
                        size='small'
                        type='tertiary'
                        onClick={fillExamples}
                      >
                        {t('填充示例')}
                      </Button>
                    ) : null}
                  </Space>
                </div>
              </>
            )}
          </div>
        </TabPane>
        <TabPane tab={t('JSON 编辑')} itemKey='json'>
          <TextArea
            value={text}
            autosize={{ minRows: 6, maxRows: 16 }}
            placeholder='[{"field":"service_tier","enabled":true,"comment":"备注"}]'
            onChange={handleJsonChange}
          />
          {jsonError ? (
            <div className='text-xs text-red-500 mt-1'>{jsonError}</div>
          ) : (
            <div className='text-xs text-gray-500 mt-1'>
              {t('JSON 数组格式：[{"field":"...","enabled":true,"comment":"..."}]')}
            </div>
          )}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default FieldPassThroughEditor;
