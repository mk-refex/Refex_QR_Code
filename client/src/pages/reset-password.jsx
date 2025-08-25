import axios from 'axios';
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link as RouterLink } from 'react-router-dom';

import { LoadingButton } from '@mui/lab';
import { alpha, styled, useTheme } from '@mui/material/styles';
// @mui
import {
  Box,
  Card,
  Link,
  Button,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
} from '@mui/material';

import { bgGradient } from 'src/theme/css';
import Footer from 'src/layouts/dashboard/footer';

import Logo from 'src/components/logo';

import Iconify from '../components/iconify';

const StyledContent = styled('div')(({ theme }) => ({
  maxWidth: 'auto',
  margin: 'auto',
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  flexDirection: 'column',
  padding: theme.spacing(12, 0),
}));

export default function ResetPasswordPage() {
  const { token } = useParams();
  const theme = useTheme();

  const [isValidToken, setIsValidToken] = useState(false);
  const [user, setUser] = useState({
    email: null,
  });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      axios
        .post(`/api/verify_token/${token}`)
        .then((response) => {
          if (response.data.status) {
            setIsValidToken(true);
            setUser(response.data.results.user);
          }
        })
        .catch((error) => {
          setIsValidToken(false);
          console.log(error);
          setMessage(error.response.data.message);
        });
    } catch (error) {
      setIsValidToken(false);
      setMessage('Unexpected error occurred!');
    }
  }, [token]);

  const handleSubmit = (event) => {
    setLoading(true);
    setMessage('');
    event.preventDefault();
    if (!password) {
      setTimeout(() => {
        setMessage('Password is required.');
        setLoading(false);
      }, 1000);
    } else if (!confirmPassword) {
      setTimeout(() => {
        setMessage('Confirm Password is required.');
        setLoading(false);
      }, 1000);
    } else {
      try {
        axios
          .patch(`/api/reset_password/${token}`, {
            password,
            confirm_password: confirmPassword,
          })
          .then((response) => {
            if (response.data.status) {
              setTimeout(() => {
                setStatus(true);
                setLoading(false);
                setMessage(response.data.message);
              }, 1000);
            }
          })
          .catch((error) => {
            setTimeout(() => {
              setStatus(false);
              setLoading(false);
              setMessage(error.response.data.message);
            }, 1000);
          });
      } catch (error) {
        setStatus(false);
        setLoading(false);
        setMessage(error.response.data.message);
      }
    }
  };

  return (
    <>
      <Helmet>
        <title> Reset Password | Refex Contacts </title>
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

        {isValidToken ? (
          <StyledContent sx={{ textAlign: 'center', alignItems: 'center' }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h3" color={!status ? 'inherit' : 'text.success'} paragraph>
                {!status ? 'Reset your password!' : message}
              </Typography>
              {!status && (
                <>
                  <Typography sx={{ color: 'text.secondary' }}>
                    Please provide a new password for user{' '}
                    <Typography display="inline" sx={{ color: 'text.primary' }}>
                      {user.email}
                    </Typography>
                  </Typography>

                  <Box component="form" noValidate onSubmit={handleSubmit} sx={{ my: 2 }}>
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      name="password"
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      autoComplete="current-password"
                      onChange={(e) => setPassword(e.target.value)}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                              <Iconify icon={showPassword ? 'eva:eye-fill' : 'eva:eye-off-fill'} />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      name="confirm_password"
                      label="Confirm Password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirm_password"
                      autoComplete="current-password"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              edge="end"
                            >
                              <Iconify
                                icon={showConfirmPassword ? 'eva:eye-fill' : 'eva:eye-off-fill'}
                              />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <LoadingButton
                      fullWidth
                      loading={loading}
                      size="large"
                      type="submit"
                      variant="contained"
                      sx={{ mt: 3, mb: 1 }}
                    >
                      Reset Password
                    </LoadingButton>

                    <Typography
                      mt={1}
                      variant="subtitle1"
                      color={status ? theme.palette.success.main : theme.palette.error.main}
                      align="center"
                    >
                      {message}
                    </Typography>
                  </Box>
                </>
              )}
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
        ) : (
          <StyledContent sx={{ textAlign: 'center', alignItems: 'center' }}>
            <Typography variant="h3" paragraph>
              {message}
            </Typography>

            <Typography sx={{ color: 'text.secondary' }}>
              Sorry, we couldn’t load the password reset form.
            </Typography>

            <Box
              component="img"
              src="/assets/illustrations/illustration_404.svg"
              sx={{ height: 260, mx: 'auto', my: { xs: 4, sm: 6 } }}
            />

            <Button to="/login" size="large" variant="contained" component={RouterLink}>
              Go To Login Page
            </Button>
          </StyledContent>
        )}
        <Footer />
      </Box>
    </>
  );
}
