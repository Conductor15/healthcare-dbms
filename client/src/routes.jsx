import {
  ApartmentOutlined,
  BulbOutlined,
  CalendarOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  HeartOutlined,
  HistoryOutlined,
  MedicineBoxOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import AccessLogsPage from './pages/access-logs/AccessLogsPage.jsx';
import AppointmentsPage from './pages/appointments/AppointmentsPage.jsx';
import DbLabPage from './pages/db-lab/DbLabPage.jsx';
import DepartmentsPage from './pages/departments/DepartmentsPage.jsx';
import VisitsPage from './pages/visits/VisitsPage.jsx';
import VitalsPage from './pages/vitals/VitalsPage.jsx';

/**
 * Sidebar menu + routes. Items without `element` render a placeholder that shows owner/step.
 * When you finish a page: import it and set `element` on YOUR line only (CONTRIBUTING §4).
 * `roles` (optional) hides the item for other roles.
 */
export const navItems = [
  {
    path: '/dashboard',
    label: 'Thống kê',
    icon: <DashboardOutlined />,
    fr: 'FR7',
    owner: 'Dương',
    step: 'S3.7',
  },
  { path: '/patients', label: 'Bệnh nhân', icon: <UserOutlined />, fr: 'FR1', owner: 'Dương', step: 'S3.1' },
  {
    path: '/search',
    label: 'Tìm kiếm bệnh nhân',
    icon: <SearchOutlined />,
    fr: 'FR5',
    owner: 'Dương',
    step: 'S3.5',
  },
  {
    path: '/appointments',
    label: 'Lịch hẹn',
    icon: <CalendarOutlined />,
    fr: 'FR3',
    owner: 'Hoàng',
    step: 'S3.3',
    element: <AppointmentsPage />,
  },
  {
    path: '/visits',
    label: 'Khám bệnh & đơn thuốc',
    icon: <FileTextOutlined />,
    fr: 'FR4 · FR6',
    owner: 'Hoàng',
    step: 'S3.4, S3.6',
    element: <VisitsPage />,
  },
  {
    path: '/vitals',
    label: 'Sinh hiệu (Cassandra)',
    icon: <HeartOutlined />,
    fr: 'FR9',
    owner: 'Hoàng',
    step: 'S3.9',
    element: <VitalsPage />,
  },
  {
    path: '/doctors',
    label: 'Bác sĩ',
    icon: <MedicineBoxOutlined />,
    fr: 'FR2',
    owner: 'Dương',
    step: 'S3.2',
  },
  {
    path: '/departments',
    label: 'Khoa phòng',
    icon: <ApartmentOutlined />,
    fr: 'FR2',
    owner: 'Hoàng',
    step: 'S0.4',
    element: <DepartmentsPage />,
  },
  {
    path: '/insights',
    label: 'Truy vấn nâng cao',
    icon: <BulbOutlined />,
    fr: 'FR8',
    owner: 'Dương',
    step: 'S3.8',
  },
  {
    path: '/access-logs',
    label: 'Nhật ký truy cập',
    icon: <HistoryOutlined />,
    fr: 'Cassandra',
    owner: 'Hoàng',
    step: 'S3.12',
    roles: ['ADMIN'],
    element: <AccessLogsPage />,
  },
  {
    path: '/db-lab',
    label: 'DB Lab',
    icon: <ExperimentOutlined />,
    fr: 'Bonus',
    owner: 'Cả 2',
    step: 'S3.10, S3.11',
    roles: ['ADMIN'],
    element: <DbLabPage />,
  },
];
