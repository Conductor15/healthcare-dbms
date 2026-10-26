// Active doctors grouped by department, backed by GET /lookups/doctors. `onLoaded` exposes the full rows
// (e.g. to read the consultation fee of the chosen doctor).
import { Select } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function DoctorSelect({ value, onChange, onLoaded, placeholder = 'Chọn bác sĩ', ...rest }) {
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    api.get('/lookups/doctors').then(({ data }) => {
      setDoctors(data);
      onLoaded?.(data);
    });
  }, []); // load once; a new onLoaded identity does not need a refetch

  const groups = Object.entries(Object.groupBy(doctors, (d) => d.departmentName)).map(([dept, list]) => ({
    label: dept,
    options: list.map((d) => ({ value: d.id, label: d.fullName })),
  }));

  return (
    <Select
      showSearch
      allowClear
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      optionFilterProp="label"
      options={groups}
      {...rest}
    />
  );
}
