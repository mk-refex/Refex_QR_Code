import axios from 'axios';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import Accordion from '@mui/material/Accordion';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import Iconify from 'src/components/iconify';

import { BRAND } from '../winter-spin/constants';

// ----------------------------------------------------------------------

const HOW_TO = [
  'Make a qualifying purchase at a participating outlet in the Pune Airport retail zone. The amount, including taxes, must meet that outlet’s minimum on a single invoice.',
  'Scan the campaign QR code on the danglers at the outlet, or on the flex banners across Pune Airport.',
  'Complete this form with your full name, mobile number, email address, the retail outlet and its location, the invoice value, and a clear photograph of the original invoice. A boarding pass photo is optional.',
  'Accept these terms. Each qualifying invoice can be entered once and receives one spin.',
];

const TERMS = [
  '1. Participation is open only to Indian citizens aged eighteen (18) years and above, with a valid government-issued ID, who are travelling via Pune Airport during the Contest Period. It is not open to foreign nationals, NRIs, OCIs, PIOs, or to employees, agents, or contractors of the Organiser, including their immediate family members. The Organiser may ask for proof of eligibility and may reject entries that do not meet these criteria.',
  '2. Eligible Persons must make a qualifying purchase at a participating outlet in the Pune Airport retail zone. Each outlet has a minimum purchase threshold, inclusive of taxes, which must be met on a single invoice. The outlets, locations, and minimums are listed on this form (Annexure I). After the purchase, the Participant may scan a campaign QR code on danglers at the outlet or on flex banners across Pune Airport. This form asks for full name, mobile number, email address, outlet and location, invoice value, and a clear photograph of the original invoice. A boarding pass photograph is optional. Submitting it is explicit consent to participate and to provide personal details to the Organiser. These terms must be accepted with the checkbox. Only this official form is considered. Each qualifying invoice is one entry. Duplicate, forged, or manipulated data, including altered invoices, is invalid and can lead to disqualification.',
  '3. Each eligible Participant who meets the outlet minimum receives one entry and one spin, whatever the outlet and whatever the amount spent above the minimum. Each entry in a weekly bumper prize draw has an equal chance. The spin can show: (a) Better Luck Next Time; or (b) Eligible for Bumper Gift through Lucky Draw; or (c) a gift worth up to ₹2,000, ₹5,000, ₹7,000, or ₹10,000.',
  '4. Outcomes (a) and (b) do not award an instant gift. All three outcomes remain eligible for the bumper gift through the lucky draw. A gift-category winner receives the corresponding instant gift from the Organiser, as set out in Annexure II. There are no cash gifts. The store manager contacts the Refex Floor Manager to verify the winning category before the gift is handed over.',
  '5. Weekly bumper prize lucky draws are conducted at the end of each week. Eligible entries, including Participants who did not spin, are included through a manual chit process. Each valid entry receives a unique entry ID. Eligible IDs for that week are printed on chits and placed in a sealed draw box. The number of chits drawn matches the prizes allocated for that week. Chits are drawn by an independent member of the Organiser’s appointed team and checked against the campaign database. If a chit is invalid or the Participant cannot be reached within seven business days, the Organiser may draw a reserve chit. Winners must provide self-attested copies of government-issued identity and address proof by email or post. Further proof may be required. The winner may need to sign an acceptance and release form. Failure to comply within ten (10) days of notification forfeits the prize, and the Organiser may select another winner.',
  '6. Prizes are subject to applicable tax deductions. A prize value above INR 10,000 attracts Tax Deducted at Source (TDS) under Section 393(3) of the Income Tax Act, 2025, currently at 30%. The winner pays the applicable TDS before claiming the prize, or authorises the Organiser to deduct the tax from the prize value where applicable. The winner shall cooperate with the Organiser, or any person nominated by it, on the procedure for claiming the prize.',
  '7. Winners pay tax on “Net winning” by NEFT or RTGS to the Organiser. A TDS certificate is issued. Payment is made to the bank account the Organiser notifies to the Participant.',
  '8. Prizes are shipped to the postal address the winner provides at the time of notification, and only after verification. If the winner pays the TDS in advance, the prize is shipped only after that tax is paid. The Organiser bears the shipping charges and is not liable for damage or loss in transit.',
  '9. If the winner does not meet the tax obligation, the Organiser need not deliver the prize and may offer it to another eligible Participant. The Organiser is not liable for a Participant’s personal tax matters.',
  '10. Prizes are non-transferable, non-negotiable, and cannot be exchanged for cash or any other item. If a prize is unavailable, the Organiser may substitute a prize of equal or lesser value.',
  '11. This Contest is independent of offers made by outlets at Pune Airport. The Organiser is not liable for a dispute between a Participant and a retail outlet about such an offer.',
  '12. Personal data, including name, contact details, and invoice information, is collected, processed, and retained by the Organiser and/or its group companies only for entry validation, operating spins, winner selection, prize distribution, legal compliance, and limited post-contest analytics. Data is kept for no more than ninety (90) days after the Contest ends, then deleted or anonymised unless the law requires longer. The Organiser does not share, sell, or disclose personal data without consent, except as required by law. Promotional consent can be withdrawn by writing to puneoperations@refex.co.in.',
  '13. The Organiser is not responsible for technical failures, server outages, incomplete submissions, or human errors. Attempts to tamper with the Contest, including bots or automated entries, can lead to permanent disqualification and legal action. The Organiser is not liable for indirect or consequential loss, including loss of chance, from participation or from being unable to win or claim a prize.',
  '14. The Organiser, its associates, and group companies are not liable for loss, expense, damage, personal injury, or death in connection with this Contest or a prize, except for liability that cannot be excluded by law. Overall liability will not exceed the actual value of the highest prize announced.',
  '15. The Organiser and its employees, representatives, directors, agents, affiliates, group companies, and promoters are not liable for incorrect information, unauthorised interference, technical or human error in administration or processing, or injury or damage from participation or from receipt, use, or misuse of a prize.',
  '16. In a force majeure event, including natural disasters, strikes, epidemics, regulatory restrictions, or any other event beyond the Organiser’s reasonable control, the Contest may be suspended, postponed, modified, or cancelled without notice. Amendments to these terms are binding once published.',
  '17. If any part of the Contest cannot run as planned, including because of a virus, network failure, bugs, tampering, fraud, or technical failure, the Organiser may cancel, terminate, modify, or suspend the Contest, or invalidate affected entries.',
  '18. The Organiser is not responsible for the warranty or guarantee of a prize. Winners must claim that from the manufacturer, service provider, or dealer, and must pay for any extended warranty. Winners release the Organiser from prize warranty obligations.',
  '19. By participating, each person confirms that they have read and agree to these terms. Winners consent to use of their name, likeness, and city of residence for promotion, including social media, press, and follow-up content, without further payment. The Organiser’s decisions on eligibility, selection, and disqualification are final.',
  '20. Instant gifts and weekly bumper prizes are in Annexure II. The Organiser may amend, substitute, or withdraw a prize without prior notice. Prizes cannot be transferred, refunded, or exchanged for cash or credit. Tax is borne by the Participant and must be paid before the prize is claimed.',
  '21. Images, if any, are for representation only. Colour, size, and specifications may differ and can change without notice. Brand names and trademarks belong to their owners.',
  '22. Participants and winners must not speak to the press or other media, or give interviews or comments about the Contest, without the Organiser’s prior written approval. They must not make negative or defamatory statements about the Contest, the Organiser, the prizes, sponsors, retail companies, or their associates, employees, or officers.',
  '23. The Organiser and the Authority are not liable for loss, damage, delay, personal injury, disappointment, or other harm from participation in the Refex Winter Carnival, including interruption, modification, cancellation, or technical failure. Participants waive claims against the Organiser, the Authority, and their officers, employees, agents, and affiliates in relation to the Contest, the prizes, or the promotion.',
  '24. These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts at Chennai, Tamil Nadu.',
  '25. These terms continue after the Contest Period ends.',
  '26. For clarifications or support, contact the Organiser at puneoperations@refex.co.in.',
  'Annexure II. Instant gifts: gifts worth up to ₹2,000, ₹5,000, ₹7,000, or ₹10,000. Weekly bumper prizes: gold or silver coins with indicative values of ₹41,000, ₹21,000, or ₹11,000.',
];

const CONSENT_TEXT =
  'I accept these Terms & Conditions and give my explicit consent to participate in the Refex Winter Carnival and to provide my personal details to the Organiser.';

const OUTLETS = [
  ['Magic Casa', 'Arrival', 1000],
  ['Opium', 'Arrival', 1000],
  ['Relay', 'Arrival', 500],
  ['Bombay Shaving Company', 'Bus gate lounge area', 1000],
  ['Tribe Amrapali', 'Bus gate lounge area', 5000],
  ['Crossword', 'Check In', 500],
  ['Accessorize London', 'Domestic security hold area', 1000],
  ['Beauty Luxe', 'Domestic security hold area', 5000],
  ['Bombay Shaving Company', 'Domestic security hold area', 1000],
  ['Craft India', 'Domestic security hold area', 1000],
  ['Crossword', 'Domestic security hold area', 500],
  ['Crossword Premium Stationery', 'Domestic security hold area', 1000],
  ['Da Milano', 'Domestic security hold area', 5000],
  ['Daily Object', 'Domestic security hold area', 1000],
  ['Embark', 'Domestic security hold area', 1000],
  ['Fabindia', 'Domestic security hold area', 2000],
  ['Forest Essentials', 'Domestic security hold area', 2000],
  ['Gadget Studio', 'Domestic security hold area', 1000],
  ['Hidesign', 'Domestic security hold area', 5000],
  ['Hush Puppies', 'Domestic security hold area', 2000],
  ['Kalamandir', 'Domestic security hold area', 20000],
  ['Kashmir Heritage', 'Domestic security hold area', 2000],
  ['LAVIE & LAVIE SPORTS', 'Domestic security hold area', 2000],
  ['MacV', 'Domestic security hold area', 2000],
  ['Madame', 'Domestic security hold area', 2000],
  ['Makaibari', 'Domestic security hold area', 500],
  ['Make Your Own Perfume', 'Domestic security hold area', 1000],
  ['Miniso', 'Domestic security hold area', 500],
  ['Mufti', 'Domestic security hold area', 2000],
  ['Opium Sunglass Lounge', 'Domestic security hold area', 2000],
  ['Pavers England', 'Domestic security hold area', 5000],
  ['Porsche Design', 'Domestic security hold area', 20000],
  ['Puma', 'Domestic security hold area', 2000],
  ['Rare Planet', 'Domestic security hold area', 1000],
  ['Relay', 'Domestic security hold area', 500],
  ['Renee Cosmetics', 'Domestic security hold area', 500],
  ['Samsonite', 'Domestic security hold area', 5000],
  ['Shahenaz Home Shop', 'Domestic security hold area', 2000],
  ['Smilen', 'Domestic security hold area', 500],
  ['Socks Xpress', 'Domestic security hold area', 500],
  ['Sunglass Hut', 'Domestic security hold area', 20000],
  ['Swarovski', 'Domestic security hold area', 20000],
  ['Sweet Dreams', 'Domestic security hold area', 2000],
  ['Tantra', 'Domestic security hold area', 1000],
  ['Tiramisu', 'Domestic security hold area', 2000],
  ['Tribe Amrapali', 'Domestic security hold area', 5000],
  ['United Colors of Benetton', 'Domestic security hold area', 2000],
  ['Zoot', 'Domestic security hold area', 1000],
  ['Accessorize London', 'International SHA', 2000],
].map(([brand, location, minimum]) => ({
  brand,
  location,
  minimum,
  label: `${brand} · ${location}`,
}));

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

function fileTypeError(file, label) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!BILL_EXTENSIONS.has(ext)) return `${label} must be a JPG, PNG, WEBP, HEIC, or PDF.`;
  if (!file.size) return `${label} file is empty.`;
  if (file.size > 10 * 1024 * 1024) return `${label} must be 10 MB or smaller.`;
  return '';
}

function invoiceError(outletLabel, raw) {
  const outlet = OUTLETS.find((item) => item.label === outletLabel);
  if (!outlet) return 'Select the outlet and location on your invoice.';
  const value = Number(String(raw || '').replace(/,/g, '').trim());
  if (!Number.isFinite(value) || value <= 0) return 'Enter the invoice value in rupees.';
  if (value < outlet.minimum) {
    return `This outlet needs an invoice of at least ₹${outlet.minimum.toLocaleString('en-IN')}.`;
  }
  if (value > 10000000) return 'Enter the invoice value shown on the bill.';
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
  const [outlet, setOutlet] = useState('');
  const [invoiceValue, setInvoiceValue] = useState('');
  const [files, setFiles] = useState([]);
  const [boardingPass, setBoardingPass] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(true);

  const loadCaptcha = async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer('');
    try {
      const res = await axios.get('/api/winter-campaign/captcha');
      setCaptcha(res.data?.results || null);
      setErrors((prev) => ({ ...prev, captcha: '' }));
    } catch (err) {
      setCaptcha(null);
      setErrors((prev) => ({
        ...prev,
        captcha: err.response?.data?.message || 'Unable to load the security check.',
      }));
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

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

  const onPickBoardingPass = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const message = fileTypeError(file, 'The boarding pass');
    setBoardingPass(message ? null : file);
    setErrors((prev) => ({ ...prev, boardingPass: message }));
  };

  const validate = () => {
    const next = {};
    const nameMessage = nameError(name);
    const emailMessage = emailError(email);
    const phoneMessage = phoneError(country, phone);
    const billMessage = billsError(files);
    const invoiceMessage = invoiceError(outlet, invoiceValue);
    const passMessage = boardingPass ? fileTypeError(boardingPass, 'The boarding pass') : '';
    if (nameMessage) next.name = nameMessage;
    if (emailMessage) next.email = emailMessage;
    if (phoneMessage) next.phone = phoneMessage;
    if (invoiceMessage) next.invoice = invoiceMessage;
    if (!consent) next.consent = 'Please agree to the terms to continue.';
    if (billMessage) next.bills = billMessage;
    if (passMessage) next.boardingPass = passMessage;
    if (!captchaAnswer.trim()) next.captcha = 'Enter the security code.';
    else if (!captcha?.token) next.captcha = 'Refresh the security code and try again.';
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
    body.append('outlet', outlet);
    body.append('invoiceValue', String(invoiceValue).replace(/,/g, '').trim());
    body.append('consent', 'true');
    body.append('captchaToken', captcha?.token || '');
    body.append('captchaAnswer', captchaAnswer.trim());
    files.forEach((file) => body.append('bills', file));
    if (boardingPass) body.append('boardingPass', boardingPass);

    try {
      setLoading(true);
      const res = await axios.post('/api/winter-campaign/register', body, { withCredentials: true });
      if (!res.data?.status) {
        setLoading(false);
        setFormError(res.data?.message || 'Unable to submit right now. Please try again.');
        loadCaptcha();
        return;
      }
      navigate('/winter-carnival/spin');
    } catch (err) {
      setLoading(false);
      setFormError(err.response?.data?.message || 'Unable to submit right now. Please try again.');
      loadCaptcha();
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
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ minWidth: 0 }}>
          <Box
            component="img"
            alt="Refex"
            src="/assets/refex-logo.png"
            sx={{ height: { xs: 32, sm: 42 }, width: 'auto', maxWidth: { xs: '62%', sm: 240 }, objectFit: 'contain' }}
          />
          <Typography variant="overline" sx={{ color: BRAND.gold, letterSpacing: { xs: 0.8, sm: 1.4 }, flexShrink: 0 }}>
            Pune Airport
          </Typography>
        </Stack>

        <Stack spacing={1.25}>
          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.15, fontSize: { xs: '1.7rem', md: '2.4rem' } }}>
            Refex Winter Carnival
          </Typography>
          <Typography variant="h6" sx={{ color: BRAND.gold, fontWeight: 700 }}>
            Shop & Win Contest at Pune International Airport
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#fff', 0.82), maxWidth: 760 }}>
            Contest Period: 9th November 2026 – 15th January 2027.
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#fff', 0.82), maxWidth: 760 }}>
            Organised by Refex Airports Retail Private Limited, having its Registered Office at Second Floor,
            Refex Towers, Sterling Road Signal, 313, Valluvar Kottam High Road, Nungambakkam, Chennai – 600034,
            Tamil Nadu, the Master Concessionaire, Pune Airport.
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#fff', 0.82), maxWidth: 760 }}>
            The Refex Winter Carnival rewards passengers who shop at select retail outlets at Pune Airport
            during the Contest Period. Participation is acceptance of the terms below. A qualifying purchase
            on a single invoice gives one entry and one spin.
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
            <Typography variant="h6">Instant gifts and weekly bumper prizes</Typography>
            <Typography variant="body2" sx={{ color: alpha('#fff', 0.88) }}>
              The wheel can show Better Luck Next Time, Eligible for Bumper Gift through Lucky Draw, or a
              gift worth up to ₹2,000, ₹5,000, ₹7,000, or ₹10,000. The first two do not include an instant
              gift. All three remain eligible for the weekly bumper lucky draw.
            </Typography>
            <Typography variant="body2" sx={{ color: alpha('#fff', 0.88) }}>
              Weekly bumper prizes are gold or silver coins with indicative values of ₹41,000, ₹21,000, or
              ₹11,000. There are no cash gifts. An instant gift is handed over only after the store manager
              confirms the winning category with the Refex Floor Manager.
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
            <Stack spacing={1.25}>
              {TERMS.map((item) => (
                <Typography key={item} variant="body2" sx={{ color: alpha('#fff', 0.82) }}>
                  {item}
                </Typography>
              ))}
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: alpha('#fff', 0.65) }}>
              The Organiser may amend these terms, and may substitute or withdraw a prize, once the change is
              published. Images, if any, are for representation only.
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
                <Typography variant="body2" sx={{ color: alpha('#fff', 0.88), wordBreak: 'break-word' }}>
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

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                select
                required
                fullWidth
                label="Outlet and location"
                value={outlet}
                disabled={loading}
                error={Boolean(errors.invoice) && !outlet}
                onChange={(e) => {
                  setOutlet(e.target.value);
                  setErrors((prev) => ({
                    ...prev,
                    invoice: invoiceValue ? invoiceError(e.target.value, invoiceValue) : '',
                  }));
                }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: { sx: { bgcolor: '#0E2438', color: '#fff', maxHeight: 320 } },
                  },
                }}
                sx={fieldSx}
              >
                {OUTLETS.map((item) => (
                  <MenuItem key={item.label} value={item.label} sx={{ color: '#fff', whiteSpace: 'normal' }}>
                    {item.brand} — {item.location} (min ₹{item.minimum.toLocaleString('en-IN')})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                required
                label="Invoice value (₹)"
                value={invoiceValue}
                disabled={loading}
                placeholder="22000"
                inputProps={{ inputMode: 'decimal' }}
                error={Boolean(errors.invoice)}
                helperText={errors.invoice || 'Amount on a single invoice, including taxes.'}
                onBlur={() => setErrors((prev) => ({ ...prev, invoice: invoiceError(outlet, invoiceValue) }))}
                onChange={(e) => {
                  setInvoiceValue(e.target.value.replace(/[^\d.]/g, ''));
                  setErrors((prev) => ({ ...prev, invoice: '' }));
                }}
                sx={{ ...fieldSx, width: { xs: 1, sm: 220 }, flexShrink: 0 }}
              />
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Invoice *</Typography>
              <Typography variant="caption" sx={{ color: alpha('#fff', 0.65) }}>
                Clear photo of the original invoice. Up to 5 files. Max 10 MB each. JPG, PNG, WEBP, HEIC, or PDF.
              </Typography>
              <Button
                variant="outlined"
                component="label"
                disabled={loading}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, color: '#fff', borderColor: alpha('#fff', 0.3) }}
              >
                Add file
                <input hidden multiple type="file" accept="image/*,.pdf,.heic,.heif" onChange={onPickFiles} />
              </Button>
              {files.map((file) => (
                <Stack key={`${file.name}-${file.size}`} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                    {file.name}
                  </Typography>
                  <Button
                    size="small"
                    color="inherit"
                    sx={{ flexShrink: 0 }}
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

            <Stack spacing={1}>
              <Typography variant="subtitle2">Boarding pass</Typography>
              <Typography variant="caption" sx={{ color: alpha('#fff', 0.65) }}>
                Optional. One clear photo or PDF. Max 10 MB.
              </Typography>
              <Button
                variant="outlined"
                component="label"
                disabled={loading}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, color: '#fff', borderColor: alpha('#fff', 0.3) }}
              >
                {boardingPass ? 'Replace file' : 'Add boarding pass'}
                <input hidden type="file" accept="image/*,.pdf,.heic,.heif" onChange={onPickBoardingPass} />
              </Button>
              {boardingPass ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                    {boardingPass.name}
                  </Typography>
                  <Button size="small" color="inherit" sx={{ flexShrink: 0 }} onClick={() => setBoardingPass(null)}>
                    Remove
                  </Button>
                </Stack>
              ) : null}
              {errors.boardingPass ? (
                <Typography variant="caption" sx={{ color: '#FFB4A8' }}>
                  {errors.boardingPass}
                </Typography>
              ) : null}
            </Stack>

            <Stack spacing={0.75}>
              <Typography variant="subtitle2">Security check *</Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                <Box
                  component="img"
                  alt="Security code"
                  src={captchaLoading ? undefined : captcha?.image}
                  sx={{
                    width: { xs: 124, sm: 148 },
                    height: 46,
                    flexShrink: 0,
                    borderRadius: 1,
                    objectFit: 'fill',
                    bgcolor: '#0E2438',
                    border: `1px solid ${alpha('#fff', 0.16)}`,
                  }}
                />
                <IconButton
                  aria-label="New security code"
                  onClick={loadCaptcha}
                  disabled={loading || captchaLoading}
                  sx={{ color: '#fff', flexShrink: 0, p: 0.75 }}
                >
                  {captchaLoading ? (
                    <CircularProgress size={18} sx={{ color: '#fff' }} />
                  ) : (
                    <Iconify icon="eva:refresh-outline" width={20} />
                  )}
                </IconButton>
                <TextField
                  required
                  size="small"
                  fullWidth
                  label="Code"
                  value={captchaAnswer}
                  disabled={loading}
                  autoComplete="off"
                  error={Boolean(errors.captcha)}
                  inputProps={{ maxLength: 8, autoCapitalize: 'characters', 'aria-label': 'Security code' }}
                  onChange={(e) => {
                    setCaptchaAnswer(e.target.value.toUpperCase());
                    setErrors((prev) => ({ ...prev, captcha: '' }));
                  }}
                  sx={fieldSx}
                />
              </Stack>
              {errors.captcha ? (
                <Typography variant="caption" sx={{ color: '#FFB4A8' }}>
                  {errors.captcha}
                </Typography>
              ) : (
                <Typography variant="caption" sx={{ color: alpha('#fff', 0.62) }}>
                  Type the characters in the image.
                </Typography>
              )}
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
              {loading ? 'Submitting…' : 'Submit & Spin'}
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}
