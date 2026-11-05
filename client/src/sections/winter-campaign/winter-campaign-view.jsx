import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';

import Iconify from 'src/components/iconify';

import { BRAND } from '../winter-spin/constants';

// ----------------------------------------------------------------------

const HOW_TO = [
  'Make a purchase at any participating Refex retail outlet at Pune Airport.',
  'Check the applicable offer and qualifying purchase amount at that outlet. Minimum value and eligibility can vary by outlet and brand.',
  'Fill in your details in this form.',
  'Upload a clear copy or photo of your purchase bill.',
  'Submit the form to unlock the Spin-the-Wheel.',
  'Spin the wheel for a chance to win prizes and receive gifts.',
];

const TERMS = [
  'The campaign is valid from Diwali to Makar Sankranti during the specified campaign period.',
  'The campaign is open to customers making eligible purchases at participating Refex retail outlets at Pune Airport.',
  'The minimum purchase value and offer eligibility may vary across outlets and brands. Check the applicable offer at the outlet before participating.',
  'Customers must submit a valid purchase bill to participate.',
  'Each participation is subject to verification of the purchase bill by the Refex Airports Retail team.',
  'Only genuine and valid bills generated during the campaign period will be considered.',
  'The bill uploaded must be clear and legible and should contain sufficient details for verification.',
  'The Spin-the-Wheel opportunity is subject to successful submission and verification of the purchase details.',
  'Prizes and gifts are subject to availability and applicable campaign rules.',
  'Prizes won through the campaign are non-transferable and cannot be exchanged for cash, unless specifically stated otherwise.',
  'Refex Airports Retail reserves the right to disqualify any entry in case of duplicate, invalid, fraudulent or manipulated bills or details.',
  'The decision of Refex Airports Retail regarding eligibility, bill verification, winner selection and prize distribution shall be final.',
  'Winners may be required to provide additional information or identification for prize collection.',
  'By submitting this form, you consent to the collection and use of the information provided for administering this campaign and contacting you regarding your participation or prize.',
  'By participating in the campaign, the customer agrees to abide by the above terms and conditions.',
];

const CONSENT_TEXT =
  'I hereby provide my consent to share my personal details for participation in the Refex Winter Carnival campaign and agree to abide by the campaign’s Terms & Conditions, including the eligibility criteria and prize redemption guidelines.';

const COUNTRIES = [
  { iso: 'IN', name: 'India', dial: '91', min: 10, max: 10 },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971', min: 8, max: 9 },
  { iso: 'AU', name: 'Australia', dial: '61', min: 9, max: 9 },
  { iso: 'BD', name: 'Bangladesh', dial: '880', min: 10, max: 10 },
  { iso: 'BH', name: 'Bahrain', dial: '973', min: 8, max: 8 },
  { iso: 'CA', name: 'Canada', dial: '1', min: 10, max: 10 },
  { iso: 'CN', name: 'China', dial: '86', min: 11, max: 11 },
  { iso: 'DE', name: 'Germany', dial: '49', min: 10, max: 11 },
  { iso: 'FR', name: 'France', dial: '33', min: 9, max: 9 },
  { iso: 'GB', name: 'United Kingdom', dial: '44', min: 10, max: 10 },
  { iso: 'HK', name: 'Hong Kong', dial: '852', min: 8, max: 8 },
  { iso: 'ID', name: 'Indonesia', dial: '62', min: 9, max: 12 },
  { iso: 'IE', name: 'Ireland', dial: '353', min: 9, max: 9 },
  { iso: 'JP', name: 'Japan', dial: '81', min: 10, max: 10 },
  { iso: 'KE', name: 'Kenya', dial: '254', min: 9, max: 9 },
  { iso: 'KW', name: 'Kuwait', dial: '965', min: 8, max: 8 },
  { iso: 'LK', name: 'Sri Lanka', dial: '94', min: 9, max: 9 },
  { iso: 'MV', name: 'Maldives', dial: '960', min: 7, max: 7 },
  { iso: 'MY', name: 'Malaysia', dial: '60', min: 9, max: 10 },
  { iso: 'NL', name: 'Netherlands', dial: '31', min: 9, max: 9 },
  { iso: 'NP', name: 'Nepal', dial: '977', min: 10, max: 10 },
  { iso: 'NZ', name: 'New Zealand', dial: '64', min: 8, max: 10 },
  { iso: 'OM', name: 'Oman', dial: '968', min: 8, max: 8 },
  { iso: 'PH', name: 'Philippines', dial: '63', min: 10, max: 10 },
  { iso: 'QA', name: 'Qatar', dial: '974', min: 8, max: 8 },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966', min: 9, max: 9 },
  { iso: 'SG', name: 'Singapore', dial: '65', min: 8, max: 8 },
  { iso: 'TH', name: 'Thailand', dial: '66', min: 9, max: 9 },
  { iso: 'US', name: 'United States', dial: '1', min: 10, max: 10 },
  { iso: 'ZA', name: 'South Africa', dial: '27', min: 9, max: 9 },
];

const BILL_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'heic', 'heif']);

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: alpha('#fff', 0.04),
    color: '#fff',
    '& fieldset': { borderColor: alpha('#fff', 0.18) },
    '&:hover fieldset': { borderColor: alpha(BRAND.gold, 0.7) },
    '&.Mui-focused fieldset': { borderColor: BRAND.gold },
  },
  '& .MuiInputLabel-root': { color: alpha('#fff', 0.72) },
  '& .MuiInputLabel-root.Mui-focused': { color: BRAND.gold },
  '& .MuiFormHelperText-root': { color: alpha('#fff', 0.62) },
  '& .MuiFormHelperText-root.Mui-error': { color: '#FFB4A8' },
};

function nationalNumber(raw) {
  return String(raw || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
}

function nameError(value) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return 'Name is required.';
  if (clean.length < 2) return 'Name must be at least 2 characters.';
  if (clean.length > 120) return 'Name must be 120 characters or fewer.';
  if (!/^[\p{L}][\p{L}\s.'-]{1,119}$/u.test(clean)) {
    return 'Use letters only. Spaces, hyphens, and apostrophes are allowed.';
  }
  return '';
}

function emailError(value) {
  const clean = value.trim();
  if (!clean) return 'Email is required.';
  if (clean.length > 180) return 'Email must be 180 characters or fewer.';
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(clean)) {
    return 'Enter a valid email address.';
  }
  return '';
}

function phoneError(country, raw) {
  const national = nationalNumber(raw);
  if (!national) return 'Phone number is required.';
  if (country.iso === 'IN' && !/^[6-9]\d{9}$/.test(national)) {
    return 'Enter a valid 10-digit Indian mobile number.';
  }
  if (national.length < country.min || national.length > country.max) {
    const span = country.min === country.max ? `${country.min}` : `${country.min}–${country.max}`;
    return `Enter a valid ${span}-digit mobile number for ${country.name}.`;
  }
  const full = `${country.dial}${national}`;
  if (full.length < 8 || full.length > 15) return 'Enter a valid mobile number.';
  return '';
}

function billsError(list) {
  if (!list.length) return 'Upload at least one bill.';
  if (list.length > 5) return 'You can upload up to 5 files.';
  const invalid = list.find((file) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    return !BILL_EXTENSIONS.has(ext);
  });
  if (invalid) return 'Upload JPG, PNG, WEBP, HEIC, or PDF files only.';
  if (list.some((file) => !file.size)) return 'One of the selected files is empty.';
  if (list.some((file) => file.size > 10 * 1024 * 1024)) return 'Each file must be 10 MB or smaller.';
  return '';
}

export default function WinterCampaignView() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const onPickFiles = (event) => {
    const picked = Array.from(event.target.files || []);
    const next = [...files];
    let message = '';
    picked.forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!BILL_EXTENSIONS.has(ext)) {
        message = 'Upload JPG, PNG, WEBP, HEIC, or PDF files only.';
        return;
      }
      if (!file.size) {
        message = 'One of the selected files is empty.';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        message = 'Each file must be 10 MB or smaller.';
        return;
      }
      if (next.length >= 5) {
        message = 'You can upload up to 5 files.';
        return;
      }
      next.push(file);
    });
    setFiles(next);
    setErrors((prev) => ({ ...prev, bills: message }));
    event.target.value = '';
  };

  const validate = () => {
    const next = {};
    const nameMessage = nameError(name);
    const emailMessage = emailError(email);
    const phoneMessage = phoneError(country, phone);
    const billMessage = billsError(files);
    if (nameMessage) next.name = nameMessage;
    if (emailMessage) next.email = emailMessage;
    if (phoneMessage) next.phone = phoneMessage;
    if (!consent) next.consent = 'Please agree to the terms to continue.';
    if (billMessage) next.bills = billMessage;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;

    const body = new FormData();
    body.append('name', name.trim().replace(/\s+/g, ' '));
    body.append('email', email.trim());
    body.append('phone', `${country.dial}${nationalNumber(phone)}`);
    body.append('consent', 'true');
    files.forEach((file) => body.append('bills', file));

    try {
      setLoading(true);
      const res = await axios.post('/api/winter-campaign/register', body, { withCredentials: true });
      if (!res.data?.status) {
        setLoading(false);
        setFormError(res.data?.message || 'Unable to submit right now. Please try again.');
        return;
      }
      navigate('/winter-spin');
    } catch (err) {
      setLoading(false);
      setFormError(err.response?.data?.message || 'Unable to submit right now. Please try again.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        color: '#fff',
        background: `
          radial-gradient(900px 420px at 0% 0%, ${alpha(BRAND.blue, 0.45)} 0%, transparent 55%),
          radial-gradient(700px 380px at 100% 8%, ${alpha(BRAND.orange, 0.28)} 0%, transparent 50%),
          linear-gradient(165deg, ${BRAND.navy} 0%, #0B2744 48%, #123A5C 100%)
        `,
      }}
    >
      <Stack spacing={3} sx={{ maxWidth: 920, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, md: 5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box
            component="img"
            alt="Refex"
            src="/assets/refex-logo.png"
            sx={{ height: 42, width: 'auto', objectFit: 'contain' }}
          />
          <Typography variant="overline" sx={{ color: BRAND.gold, letterSpacing: 1.4 }}>
            Pune Airport
          </Typography>
        </Stack>

        <Stack spacing={1.25}>
          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.15, fontSize: { xs: '1.7rem', md: '2.4rem' } }}>
            Refex Winter Campaign
          </Typography>
          <Typography variant="h6" sx={{ color: BRAND.gold, fontWeight: 700 }}>
            Shop now and win prizes
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.82), maxWidth: 760 }}>
            Celebrate the festive season with Refex Airports Retail, Pune Airport. From Diwali to Makar
            Sankranti, customers making eligible purchases at participating Refex retail outlets can join
            the Spin-the-Wheel and get a chance to win prizes and receive gifts.
          </Typography>
        </Stack>

        <Card sx={{ bgcolor: alpha('#fff', 0.04), color: '#fff', border: `1px solid ${alpha('#fff', 0.08)}` }}>
          <Stack spacing={1.25} sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6">How to participate</Typography>
            {HOW_TO.map((step, index) => (
              <Stack key={step} direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    bgcolor: alpha(BRAND.gold, 0.18),
                    color: BRAND.gold,
                  }}
                >
                  {index + 1}
                </Box>
                <Typography variant="body2" sx={{ color: alpha('#fff', 0.86), pt: 0.4 }}>
                  {step}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Card>

        <Card sx={{ bgcolor: alpha(BRAND.orange, 0.12), color: '#fff', border: `1px solid ${alpha(BRAND.orange, 0.28)}` }}>
          <Stack spacing={1} sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6">Weekly and bumper prizes</Typography>
            <Typography variant="body2" sx={{ color: alpha('#fff', 0.88) }}>
              In addition to instant Spin-the-Wheel rewards, weekly prizes and bumper prizes up to ₹75,000
              are part of the Refex Winter Campaign. Gift vouchers and prizes are sponsored by participating
              brand partners, along with prizes contributed by Refex Airports Retail.
            </Typography>
          </Stack>
        </Card>

        <Accordion
          disableGutters
          sx={{
            bgcolor: alpha('#fff', 0.04),
            color: '#fff',
            border: `1px solid ${alpha('#fff', 0.08)}`,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" sx={{ color: '#fff' }} />}>
            <Typography fontWeight={700}>Terms and conditions</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.25 }}>
              {TERMS.map((item) => (
                <Typography key={item} component="li" variant="body2" sx={{ color: alpha('#fff', 0.82) }}>
                  {item}
                </Typography>
              ))}
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: alpha('#fff', 0.65) }}>
              All offers, rewards, purchase requirements and campaign benefits are subject to change without
              prior notice and may apply only to select merchandise or specific participating brands and outlets.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Card component="form" noValidate onSubmit={handleSubmit} sx={{ bgcolor: '#10283F', color: '#fff' }}>
          <Stack spacing={2.25} sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={0.5}>
              <Typography variant="overline" sx={{ color: BRAND.gold }}>
                Customer details
              </Typography>
              <Typography variant="h5">Submit once to unlock your spin</Typography>
              <Typography variant="body2" sx={{ color: alpha('#fff', 0.7) }}>
                One entry per email and phone number. Required fields are marked.
              </Typography>
            </Stack>

            {formError ? <Alert severity="error">{formError}</Alert> : null}

            <TextField
              required
              label="Email"
              type="email"
              value={email}
              disabled={loading}
              error={Boolean(errors.email)}
              helperText={errors.email || 'This email is stored with your response.'}
              onBlur={() => setErrors((prev) => ({ ...prev, email: emailError(email) }))}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: '' }));
              }}
              sx={fieldSx}
            />

            <FormControlLabel
              sx={{ alignItems: 'flex-start', mx: 0 }}
              control={
                <Checkbox
                  checked={consent}
                  disabled={loading}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    setErrors((prev) => ({ ...prev, consent: '' }));
                  }}
                  sx={{ color: alpha('#fff', 0.7), '&.Mui-checked': { color: BRAND.gold } }}
                />
              }
              label={
                <Typography variant="body2" sx={{ color: alpha('#fff', 0.88) }}>
                  {CONSENT_TEXT} *
                </Typography>
              }
            />
            {errors.consent ? (
              <Typography variant="caption" sx={{ color: '#FFB4A8', mt: -1 }}>
                {errors.consent}
              </Typography>
            ) : null}

            <TextField
              required
              label="Name"
              value={name}
              disabled={loading}
              error={Boolean(errors.name)}
              helperText={errors.name || ' '}
              onBlur={() => setErrors((prev) => ({ ...prev, name: nameError(name) }))}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: '' }));
              }}
              sx={fieldSx}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                select
                required
                label="Country"
                value={country.iso}
                disabled={loading}
                onChange={(e) => {
                  const next = COUNTRIES.find((item) => item.iso === e.target.value) || COUNTRIES[0];
                  setCountry(next);
                  setErrors((prev) => ({ ...prev, phone: phone ? phoneError(next, phone) : '' }));
                }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: { sx: { bgcolor: '#0E2438', color: '#fff', maxHeight: 320 } },
                  },
                }}
                sx={{ ...fieldSx, width: { xs: 1, sm: 220 }, flexShrink: 0 }}
              >
                {COUNTRIES.map((item) => (
                  <MenuItem key={item.iso} value={item.iso} sx={{ color: '#fff' }}>
                    {item.name} (+{item.dial})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                required
                fullWidth
                label="Phone Number"
                value={phone}
                disabled={loading}
                placeholder={country.iso === 'IN' ? '9876543210' : ''}
                inputProps={{ inputMode: 'numeric', maxLength: country.max + 2 }}
                error={Boolean(errors.phone)}
                helperText={errors.phone || `${country.name} (+${country.dial})`}
                onBlur={() => setErrors((prev) => ({ ...prev, phone: phoneError(country, phone) }))}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/[^\d\s-]/g, ''));
                  setErrors((prev) => ({ ...prev, phone: '' }));
                }}
                sx={fieldSx}
              />
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Bill *</Typography>
              <Typography variant="caption" sx={{ color: alpha('#fff', 0.65) }}>
                Upload up to 5 files. Max 10 MB per file. JPG, PNG, WEBP, HEIC, or PDF.
              </Typography>
              <Button
                variant="outlined"
                component="label"
                disabled={loading}
                sx={{ alignSelf: 'flex-start', color: '#fff', borderColor: alpha('#fff', 0.3) }}
              >
                Add file
                <input hidden multiple type="file" accept="image/*,.pdf,.heic,.heif" onChange={onPickFiles} />
              </Button>
              {files.map((file) => (
                <Stack key={`${file.name}-${file.size}`} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" noWrap sx={{ maxWidth: '75%' }}>
                    {file.name}
                  </Typography>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setFiles((prev) => prev.filter((item) => item !== file))}
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
              {errors.bills ? (
                <Typography variant="caption" sx={{ color: '#FFB4A8' }}>
                  {errors.bills}
                </Typography>
              ) : null}
            </Stack>

            <Button
              type="submit"
              size="large"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : null}
              sx={{
                py: 1.4,
                fontWeight: 800,
                color: '#fff',
                bgcolor: BRAND.blue,
                boxShadow: 'none',
                '&:hover': { bgcolor: BRAND.blueDeep, boxShadow: 'none' },
                '&.Mui-disabled': { color: '#fff', bgcolor: BRAND.blue },
              }}
            >
              {loading ? 'Submitting…' : 'Submit and spin'}
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}
