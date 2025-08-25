import axios from 'axios';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import { LoadingButton } from '@mui/lab';
import { alpha, styled, useTheme } from '@mui/material/styles';
// @mui
import { Box, Card, Link, TextField, Typography } from '@mui/material';

import { bgGradient } from 'src/theme/css';
import Footer from 'src/layouts/dashboard/footer';

import Logo from 'src/components/logo';

const StyledContent = styled('div')(({ theme }) => ({
  maxWidth: 700,
  margin: 'auto',
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  flexDirection: 'column',
  padding: theme.spacing(12, 0),
}));

export default function ForgotPasswordPage() {
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (event) => {
    setLoading(true);
    setErrorMessage('');
    event.preventDefault();
    if (email === '' || email === null) {
      setTimeout(() => {
        setErrorMessage('Email is required.');
        setLoading(false);
      }, 1000);
    } else {
      try {
        axios
          .post(`/api/forgot_password`, { email })
          .then((response) => {
            console.log(response);
            if (response.data.status) {
              setStatus(true);
              setLoading(false);
              setErrorMessage(response.data.message);
            }
          })
          .catch((error) => {
            setTimeout(() => {
              setLoading(false);
              setErrorMessage(error.response.data.message);
            }, 1000);
          });
      } catch (error) {
        setTimeout(() => {
          setLoading(false);
          setErrorMessage(error.message);
        }, 1000);
      }
    }
  };

  return (
    <>
      <Helmet>
        <title> Forgot Password | Refex Contacts </title>
      </Helmet>

      <Box
        sx={{
          ...bgGradient({
            color: alpha(theme.palette.background.default, 0.9),
            imgUrl: '/assets/background/overlay_4.jpg',
          }),
          height: 1,
        }}
      >
        <Logo
          sx={{
            position: 'fixed',
            top: { xs: 16, md: 24 },
            left: { xs: 16, md: 24 },
          }}
        />

        <StyledContent sx={{ textAlign: 'center', alignItems: 'center' }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h3" paragraph>
              Forgot your password ?
            </Typography>

            <Typography sx={{ color: 'text.secondary' }}>
              Please enter your email address. You will receive a link to reset your password via
              email.
            </Typography>

            <Box component="form" noValidate onSubmit={handleSubmit} sx={{ my: 2 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
              />
              {!status && (
                <LoadingButton
                  fullWidth
                  loading={loading}
                  size="large"
                  type="submit"
                  variant="contained"
                  sx={{ mt: 3, mb: 1 }}
                >
                  Request reset link
                </LoadingButton>
              )}
              <Typography
                mt={1}
                variant="subtitle1"
                color={status ? theme.palette.success.main : theme.palette.error.main}
                align="center"
              >
                {errorMessage}
              </Typography>
            </Box>
            <Typography
              variant="subtitle1"
              display="inline-block"
              color="info"
              sx={{ fontWeight: 900 }}
            >
              <Link href="/login" underline="hover">
                Go To Login Page
              </Link>
            </Typography>
          </Card>
        </StyledContent>
        <Footer />
      </Box>
    </>
  );
}
