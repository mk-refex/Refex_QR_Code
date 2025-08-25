import PropTypes from 'prop-types';

import Box from '@mui/material/Box';

// import Nav from './nav';
import Main from './main';
import Header from './header';
import Footer from './footer';
// import { QRCode } from 'react-qrcode-logo';
// import { Stack } from '@mui/material';

// ----------------------------------------------------------------------

export default function DashboardLayout({ children }) {
  // const [openNav, setOpenNav] = useState(false);

  return (
    <>
      {/* <Header onOpenNav={() => setOpenNav(true)} /> */}
      <Header />

      <Box
        sx={{
          minHeight: 1,
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
        }}
      >
        {/* <Nav openNav={openNav} onCloseNav={() => setOpenNav(false)} /> */}

        <Main>{children}</Main>
      </Box>
      {/* <Stack flexDirection='column' justifyContent='center' alignItems='center'>
      <QRCode value='https://contact.refex.group/empvcard/2055' logoImage='/assets/Refex-Logo.png' logoWidth={72} logoHeight={22} size={200} qrStyle='dots' eyeRadius={10} removeQrCodeBehindLogo logoPadding={1}/>
      </Stack> */}
      <Footer />
    </>
  );
}

DashboardLayout.propTypes = {
  children: PropTypes.node,
};
