import PropTypes from 'prop-types';
import { lazy, Suspense } from 'react';
import { Outlet, Navigate, useRoutes } from 'react-router-dom';

import LogoutPage from 'src/pages/logout';
import { useAuth } from 'src/context/AuthContext';
import DashboardLayout from 'src/layouts/dashboard';

export const BrochureFormPage = lazy(() => import('src/pages/brochure-form'));
export const ContestFormPage = lazy(() => import('src/pages/contest-form'));
export const BrochureDownloadForm = lazy(() => import('src/pages/brochure-download'));
export const QRCodeLinkPage = lazy(() => import('src/pages/qr-code-link'));
export const InstaLinkPage = lazy(() => import('src/pages/qr-insta'));
export const EmployeeListPage = lazy(() => import('src/pages/employee-list'));
export const EmployeeCreatePage = lazy(() => import('src/pages/employee-create'));
export const EmployeeViewPage = lazy(() => import('src/pages/employee-view'));
export const EmployeeEditPage = lazy(() => import('src/pages/employee-edit'));
export const UserPage = lazy(() => import('src/pages/user'));
export const LoginPage = lazy(() => import('src/pages/login'));
export const ForgotPasswordPage = lazy(() => import('src/pages/forgot-password'));
export const ResetPasswordPage = lazy(() => import('src/pages/reset-password'));
export const Page404 = lazy(() => import('src/pages/page-not-found'));

// ----------------------------------------------------------------------

export default function Router() {
  const { isAuthenticated, user } = useAuth();
  // console.log(user);
  const PrivateRoute = ({ element, accessType, ...rest }) => {
    // Check if the user is authenticated
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    // Check if the user type matches the required access type
    if (accessType && user && user.type !== accessType) {
      return <Navigate to="/404" />;
    }

    // Render the protected route
    return element;
  };

  PrivateRoute.propTypes = {
    element: PropTypes.element,
    accessType: PropTypes.string,
  };

  const routes = useRoutes([
    {
      element: (
        <PrivateRoute
          element={
            <DashboardLayout>
              <Suspense>
                <Outlet />
              </Suspense>
            </DashboardLayout>
          }
        />
      ),
      children: [
        { element: <Navigate to="/employees" />, index: true },
        {
          path: 'employees',
          children: [
            { element: <Navigate to="/employees/list" />, index: true },
            { path: 'list', element: <EmployeeListPage /> },
            { path: 'create', element: <EmployeeCreatePage /> },
            { path: 'view/:employeeId', element: <EmployeeViewPage /> },
            { path: 'edit/:employeeId', element: <EmployeeEditPage /> },
          ],
        },
        {
          path: 'logout',
          element: <LogoutPage />,
        },
      ],
    },
    {
      path: 'login',
      element: isAuthenticated ? <Navigate to="/employees" replace /> : <LoginPage />,
    },
    {
      path: 'airport',
      children: [
        { element: <Navigate to="/airport/fly_buy_summer" />, index: true },
        { path: 'fly_buy_summer', element: <ContestFormPage /> },
      ],
    },
    {
      path: 'brochure_form',
      element: <BrochureFormPage />,
    },
    {
      path: 'brochure_download_form/:file',
      element: <BrochureDownloadForm />,
    },
    {
      path: 'qr_eveelz',
      element: <QRCodeLinkPage />,
    },
    {
      path: 'ratna_award_2024',
      element: <InstaLinkPage />,
    },
    {
      path: 'forgot_password',
      element: <ForgotPasswordPage />,
    },
    {
      path: 'reset_password/:token',
      element: <ResetPasswordPage />,
    },
    {
      path: '404',
      element: <Page404 />,
    },
    {
      path: '*',
      element: <Navigate to="/404" replace />,
    },
  ]);

  return routes;
}
