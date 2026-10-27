// Searchable patient picker (name or phone) backed by GET /lookups/patients. Works inside antd Form.Item.
import { Select, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { fmtDate } from '../utils/format.js';

const toOption = (p) => ({
  value: p.id,
  label: `${p.fullName}${p.phone ? ` · ${p.phone}` : ''}`,
  title: `Sinh ngày ${fmtDate(p.dateOfBirth)}`,
});

/** `initialOption` ({ value, label }) shows a preselected patient before any search has run. */
export default function PatientSelect({
  value,
  onChange,
  initialOption,
  placeholder = 'Tìm bệnh nhân theo tên hoặc SĐT',
  ...rest
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef();

  const search = (q) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/lookups/patients', { params: { q: q || undefined } });
        setOptions(data.map(toOption));
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  useEffect(() => {
    search('');
    return () => clearTimeout(timer.current);
  }, []);

  return (
    <Select
      showSearch
      allowClear
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      filterOption={false}
      onSearch={search}
      options={
        initialOption && !options.some((o) => o.value === initialOption.value)
          ? [initialOption, ...options]
          : options
      }
      notFoundContent={loading ? <Spin size="small" /> : 'Không tìm thấy bệnh nhân'}
      {...rest}
    />
  );
}
