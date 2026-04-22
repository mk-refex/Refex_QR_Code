import SvgColor from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name) => (
  <SvgColor src={`/assets/icons/navbar/${name}.svg`} sx={{ width: 1, height: 1 }} />
);

const navConfig = [
  {
    title: 'Assets List',
    path: '/assets/list',
    icon: icon('ic_blog'),
  },
  {
    title: 'Assets API Access',
    path: '/assets/api-access',
    icon: icon('ic_lock'),
  },
];

export default navConfig;
