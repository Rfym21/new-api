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

import React, { useEffect, useState } from 'react';
import {
  Button,
  Col,
  Form,
  InputNumber,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconPlus } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { showError, showSuccess, showWarning } from '../../helpers';

const { Text } = Typography;

/**
 * 分组速率限制可视化编辑器
 * @param {Object} props - 组件属性
 * @param {string} props.value - JSON 字符串格式的分组速率限制配置
 * @param {Function} props.onChange - 值变化回调函数
 */
export default function GroupRateLimitEditor({ value, onChange }) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [newGroup, setNewGroup] = useState({
    name: '',
    totalCount: 0,
    successCount: 1000,
  });

  useEffect(() => {
    parseGroupsFromJSON(value);
  }, [value]);

  /**
   * 从 JSON 字符串解析分组配置
   * @param {string} jsonStr - JSON 字符串
   */
  const parseGroupsFromJSON = (jsonStr) => {
    if (!jsonStr || jsonStr.trim() === '') {
      setGroups([]);
      return;
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const groupArray = Object.entries(parsed).map(([name, limits]) => ({
        name,
        totalCount: limits[0],
        successCount: limits[1],
      }));
      setGroups(groupArray);
    } catch (error) {
      console.error('Failed to parse group rate limit JSON:', error);
      setGroups([]);
    }
  };

  /**
   * 将分组配置转换为 JSON 字符串并触发 onChange
   * @param {Array} groupArray - 分组配置数组
   */
  const updateJSON = (groupArray) => {
    if (groupArray.length === 0) {
      onChange('');
      return;
    }

    const jsonObj = {};
    groupArray.forEach((group) => {
      jsonObj[group.name] = [group.totalCount, group.successCount];
    });
    onChange(JSON.stringify(jsonObj, null, 2));
  };

  /**
   * 添加新分组
   */
  const handleAddGroup = () => {
    if (!newGroup.name.trim()) {
      showWarning(t('请输入分组名称'));
      return;
    }

    if (groups.some((g) => g.name === newGroup.name)) {
      showWarning(t('分组名称已存在'));
      return;
    }

    if (newGroup.totalCount < 0) {
      showWarning(t('最多请求次数必须大于等于0'));
      return;
    }

    if (newGroup.successCount < 1) {
      showWarning(t('最多请求完成次数必须大于等于1'));
      return;
    }

    if (newGroup.totalCount > 2147483647 || newGroup.successCount > 2147483647) {
      showWarning(t('限制次数不能超过2147483647'));
      return;
    }

    const updatedGroups = [...groups, { ...newGroup }];
    setGroups(updatedGroups);
    updateJSON(updatedGroups);
    setNewGroup({ name: '', totalCount: 0, successCount: 1000 });
    showSuccess(t('添加成功'));
  };

  /**
   * 删除分组
   * @param {string} groupName - 分组名称
   */
  const handleDeleteGroup = (groupName) => {
    const updatedGroups = groups.filter((g) => g.name !== groupName);
    setGroups(updatedGroups);
    updateJSON(updatedGroups);
    showSuccess(t('删除成功'));
  };

  /**
   * 更新分组配置
   * @param {string} groupName - 分组名称
   * @param {string} field - 字段名
   * @param {number} value - 新值
   */
  const handleUpdateGroup = (groupName, field, value) => {
    const updatedGroups = groups.map((g) => {
      if (g.name === groupName) {
        return { ...g, [field]: value };
      }
      return g;
    });
    setGroups(updatedGroups);
    updateJSON(updatedGroups);
  };

  const columns = [
    {
      title: t('分组名称'),
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: t('最多请求次数'),
      dataIndex: 'totalCount',
      key: 'totalCount',
      render: (value, record) => (
        <InputNumber
          value={value}
          min={0}
          max={2147483647}
          step={1}
          suffix={t('次')}
          style={{ width: '150px' }}
          onChange={(val) => handleUpdateGroup(record.name, 'totalCount', val)}
        />
      ),
    },
    {
      title: t('最多请求完成次数'),
      dataIndex: 'successCount',
      key: 'successCount',
      render: (value, record) => (
        <InputNumber
          value={value}
          min={1}
          max={2147483647}
          step={1}
          suffix={t('次')}
          style={{ width: '150px' }}
          onChange={(val) => handleUpdateGroup(record.name, 'successCount', val)}
        />
      ),
    },
    {
      title: t('操作'),
      key: 'action',
      render: (text, record) => (
        <Button
          type="danger"
          icon={<IconDelete />}
          size="small"
          onClick={() => handleDeleteGroup(record.name)}
        >
          {t('删除')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text strong>{t('分组速率限制配置')}</Text>
        <div style={{ marginTop: 8, color: 'var(--semi-color-text-2)' }}>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>{t('最多请求次数：包括失败请求的次数，0代表不限制')}</li>
            <li>{t('最多请求完成次数：只包括请求成功的次数')}</li>
            <li>{t('分组速率配置优先级高于全局速率限制')}</li>
            <li>{t('限制周期统一使用上方配置的"限制周期"值')}</li>
          </ul>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={groups}
        pagination={false}
        rowKey="name"
        empty={t('暂无分组配置')}
        style={{ marginBottom: 16 }}
      />

      <Form layout="horizontal">
        <Form.Section text={t('添加新分组')}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Input
                label={t('分组名称')}
                value={newGroup.name}
                placeholder={t('例如：vip, default')}
                onChange={(value) => setNewGroup({ ...newGroup, name: value })}
              />
            </Col>
            <Col span={6}>
              <Form.InputNumber
                label={t('最多请求次数')}
                value={newGroup.totalCount}
                min={0}
                max={2147483647}
                step={1}
                suffix={t('次')}
                onChange={(value) => setNewGroup({ ...newGroup, totalCount: value })}
              />
            </Col>
            <Col span={6}>
              <Form.InputNumber
                label={t('最多请求完成次数')}
                value={newGroup.successCount}
                min={1}
                max={2147483647}
                step={1}
                suffix={t('次')}
                onChange={(value) => setNewGroup({ ...newGroup, successCount: value })}
              />
            </Col>
            <Col span={6}>
              <div style={{ paddingTop: 30 }}>
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  onClick={handleAddGroup}
                >
                  {t('添加')}
                </Button>
              </div>
            </Col>
          </Row>
        </Form.Section>
      </Form>
    </div>
  );
}
