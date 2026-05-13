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
import { Button, Modal } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import BatchUserActionModal from './modals/BatchUserActionModal';

const UsersActions = ({ setShowAddUser, refresh, t }) => {
  const [batchVisible, setBatchVisible] = useState(false);
  const [purging, setPurging] = useState(false);

  const handleAddUser = () => {
    setShowAddUser(true);
  };

  const handlePurgeDeleted = () => {
    Modal.warning({
      title: t('一键清理已注销用户'),
      content: t(
        '将物理删除所有处于已注销状态的用户记录，操作不可撤销，是否继续？',
      ),
      onOk: async () => {
        setPurging(true);
        try {
          const res = await API.post('/api/user/purge_deleted');
          const { success, message, data } = res.data;
          if (success) {
            showSuccess(
              t('已清理 ${n} 个已注销用户').replace('${n}', data?.deleted ?? 0),
            );
            refresh && refresh();
          } else {
            showError(message);
          }
        } catch (e) {
          showError(t('清理失败'));
        } finally {
          setPurging(false);
        }
      },
    });
  };

  return (
    <div className='flex gap-2 w-full md:w-auto order-2 md:order-1 flex-wrap'>
      <Button className='w-full md:w-auto' onClick={handleAddUser} size='small'>
        {t('添加用户')}
      </Button>
      <Button
        className='w-full md:w-auto'
        onClick={() => setBatchVisible(true)}
        size='small'
        type='warning'
      >
        {t('批量按额度操作')}
      </Button>
      <Button
        className='w-full md:w-auto'
        onClick={handlePurgeDeleted}
        size='small'
        type='danger'
        loading={purging}
      >
        {t('清理已注销')}
      </Button>

      <BatchUserActionModal
        visible={batchVisible}
        handleClose={() => setBatchVisible(false)}
        refresh={refresh}
        t={t}
      />
    </div>
  );
};

export default UsersActions;
