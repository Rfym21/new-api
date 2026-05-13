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

import React, { useState } from 'react';
import {
  Modal,
  Form,
  Banner,
  Tag,
  Space,
} from '@douyinfe/semi-ui';
import {
  API,
  showError,
  showSuccess,
  showWarning,
  getQuotaPerUnit,
} from '../../../../helpers';

/**
 * 按额度区间批量禁用 / 注销用户
 * 字段说明：
 * - 已用金额: 用户消耗过的额度（user.used_quota）
 * - 剩余金额: 用户当前账户剩余额度（user.quota）
 * - 总额度: 已用 + 剩余
 *
 * 输入单位为美元（与系统额度展示一致），后端按 quota_per_unit 折算成内部单位。
 */
const BatchUserActionModal = ({ visible, handleClose, refresh, t }) => {
  const [formApi, setFormApi] = useState(null);
  const [matched, setMatched] = useState(null);
  const [loading, setLoading] = useState(false);

  const buildPayload = (values, action) => {
    const perUnit = getQuotaPerUnit() || 500000;
    const toQuota = (v) => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = parseFloat(v);
      if (Number.isNaN(n)) return undefined;
      return Math.round(n * perUnit);
    };
    const payload = {
      action,
      used_quota_min: toQuota(values?.used_quota_min),
      used_quota_max: toQuota(values?.used_quota_max),
      remaining_quota_min: toQuota(values?.remaining_quota_min),
      remaining_quota_max: toQuota(values?.remaining_quota_max),
      total_quota_min: toQuota(values?.total_quota_min),
      total_quota_max: toQuota(values?.total_quota_max),
    };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });
    return payload;
  };

  const hasAnyCondition = (payload) => {
    return [
      'used_quota_min',
      'used_quota_max',
      'remaining_quota_min',
      'remaining_quota_max',
      'total_quota_min',
      'total_quota_max',
    ].some((k) => payload[k] !== undefined);
  };

  const handlePreview = async () => {
    const values = formApi?.getValues() || {};
    const payload = buildPayload(values, 'disable');
    payload.dry_run = true;
    if (!hasAnyCondition(payload)) {
      showWarning(t('至少填写一个条件'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/batch/quota_action', payload);
      const { success, message, data } = res.data;
      if (success) {
        setMatched(data?.matched ?? 0);
      } else {
        showError(message);
      }
    } catch (e) {
      showError(t('预览失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    const values = formApi?.getValues() || {};
    const payload = buildPayload(values, action);
    if (!hasAnyCondition(payload)) {
      showWarning(t('至少填写一个条件'));
      return;
    }
    const verb = action === 'disable' ? t('禁用') : t('注销');
    if (!window.confirm(t('确认要${verb}匹配的用户吗？此操作不可撤销。').replace('${verb}', verb))) {
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/batch/quota_action', payload);
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(
          t('操作成功，共影响 ${n} 个用户').replace('${n}', data?.affected ?? 0),
        );
        setMatched(null);
        refresh && refresh();
        handleClose();
      } else {
        showError(message);
      }
    } catch (e) {
      showError(t('操作失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('按额度批量禁用 / 注销用户')}
      visible={visible}
      onCancel={() => {
        setMatched(null);
        handleClose();
      }}
      width={560}
      footer={
        <Space>
          <Tag color='blue' size='large' className='!mr-2'>
            {matched === null
              ? t('点击预览查看匹配数')
              : t('匹配 ${n} 人').replace('${n}', matched)}
          </Tag>
          <button
            className='semi-button semi-button-tertiary'
            disabled={loading}
            onClick={handlePreview}
          >
            {t('预览匹配')}
          </button>
          <button
            className='semi-button semi-button-warning'
            disabled={loading}
            onClick={() => handleAction('disable')}
          >
            {t('批量禁用')}
          </button>
          <button
            className='semi-button semi-button-danger'
            disabled={loading}
            onClick={() => handleAction('cancel')}
          >
            {t('批量注销')}
          </button>
        </Space>
      }
    >
      <Banner
        type='warning'
        description={t(
          '仅作用于普通用户，管理员与 root 用户会被自动跳过；金额单位为美元。',
        )}
        closeIcon={null}
        className='!mb-3'
      />
      <Form getFormApi={(api) => setFormApi(api)} labelPosition='left' labelWidth={110}>
        <Form.InputNumber
          field='used_quota_min'
          label={t('已用金额 ≥')}
          placeholder='$'
          min={0}
          step={1}
        />
        <Form.InputNumber
          field='used_quota_max'
          label={t('已用金额 ≤')}
          placeholder='$'
          min={0}
          step={1}
        />
        <Form.InputNumber
          field='remaining_quota_min'
          label={t('剩余金额 ≥')}
          placeholder='$'
          min={0}
          step={1}
        />
        <Form.InputNumber
          field='remaining_quota_max'
          label={t('剩余金额 ≤')}
          placeholder='$'
          min={0}
          step={1}
        />
        <Form.InputNumber
          field='total_quota_min'
          label={t('总额度 ≥')}
          placeholder='$'
          min={0}
          step={1}
        />
        <Form.InputNumber
          field='total_quota_max'
          label={t('总额度 ≤')}
          placeholder='$'
          min={0}
          step={1}
        />
      </Form>
    </Modal>
  );
};

export default BatchUserActionModal;
