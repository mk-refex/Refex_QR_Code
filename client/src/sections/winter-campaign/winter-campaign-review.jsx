import axios from 'axios';
import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { isAdmin } from 'src/utils/roles';

import { useAuth } from 'src/context/AuthContext';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatPhone(value) {
  const digits = String(value || '');
  if (digits.length > 10) return `+${digits}`;
  return digits || '—';
}

function billFileName(bill) {
  const name = String(bill?.originalName || 'bill').replace(/[\\/:*?"<>|]/g, '_').trim();
  return name.slice(0, 180) || 'bill';
}

function IconAction({ title, icon, color = 'default', onClick }) {
  return (
    <Tooltip title={title}>
      <IconButton size="small" color={color} aria-label={title} onClick={onClick}>
        <Iconify icon={icon} width={18} />
      </IconButton>
    </Tooltip>
  );
}

IconAction.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  color: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};

function PrizeChip({ label, isWin }) {
  if (!label) return 'Not spun';
  return (
    <Chip
      size="small"
      label={label}
      color={isWin ? 'success' : 'default'}
      sx={{ maxWidth: 1, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
    />
  );
}

PrizeChip.propTypes = {
  label: PropTypes.string,
  isWin: PropTypes.bool,
};

export default function WinterCampaignReview() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const canManage = isAdmin(user);
  const [tab, setTab] = useState('entries');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [info, setInfo] = useState({ records: [], total: 0, totalPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const path = tab === 'winners' ? '/api/winter-campaign/winners' : '/api/winter-campaign/submissions';
    try {
      const res = await axios.get(path, { params: { page, limit: 10, search: query } });
      setInfo(res.data?.results || { records: [], total: 0, totalPage: 1 });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load records.');
      setInfo({ records: [], total: 0, totalPage: 1 });
    } finally {
      setLoading(false);
    }
  }, [tab, page, query]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchBill = async (bill) => {
    const res = await axios.get(`/api/winter-campaign/bills/${bill.id}`, { responseType: 'blob' });
    return res.data;
  };

  const openBill = async (bill) => {
    try {
      const file = await fetchBill(bill);
      const url = URL.createObjectURL(file);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to open the bill.');
    }
  };

  const downloadBill = async (bill) => {
    try {
      const file = await fetchBill(bill);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = billFileName(bill);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to download the bill.');
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    setError('');
    try {
      await axios.put(`/api/winter-campaign/submissions/${editRow.id}`, editForm);
      setEditRow(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update the entry.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError('');
    const path =
      deleteTarget.kind === 'winner'
        ? `/api/winter-campaign/winners/${deleteTarget.id}`
        : `/api/winter-campaign/submissions/${deleteTarget.id}`;
    try {
      await axios.delete(path);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to remove the record.');
    } finally {
      setSaving(false);
    }
  };

  const records = info.records || [];

  const exportExcel = async () => {
    setExporting(true);
    setError('');
    try {
      const res = await axios.get('/api/winter-campaign/export', {
        params: { search: query },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'winter-campaign.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to export the list.');
    } finally {
      setExporting(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({ name: row.name, email: row.email, phone: row.phone });
  };

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2 }, py: { xs: 1, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            Winter Campaign
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Submitted customer details, purchase bills, and winners.
            {canManage ? ' Admins can edit or remove records.' : ' This role can view records.'}
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Tabs
            value={tab}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            onChange={(_event, value) => {
              setTab(value);
              setPage(1);
            }}
            sx={{ maxWidth: 1 }}
          >
            <Tab value="entries" label="Entries" />
            <Tab value="winners" label="Winners" />
          </Tabs>
          <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
          <TextField
            size="small"
            fullWidth={isMobile}
            label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setPage(1);
                setQuery(search.trim());
              }
            }}
            sx={{ width: { xs: 1, sm: 220 } }}
          />
          <Button
            variant="contained"
            onClick={() => {
              setPage(1);
              setQuery(search.trim());
            }}
            sx={{ width: { xs: 1, sm: 'auto' } }}
          >
            Search
          </Button>
          <Button
            variant="outlined"
            disabled={exporting}
            startIcon={
              exporting ? <CircularProgress size={16} /> : <Iconify icon="mdi:microsoft-excel" width={18} />
            }
            onClick={exportExcel}
            sx={{ width: { xs: 1, sm: 'auto' } }}
          >
            Export
          </Button>
        </Stack>

        {error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : null}

        <Card>
          {isMobile ? (
            <Box>
              {loading ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              ) : null}
              {!loading && records.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                  No records found.
                </Typography>
              ) : null}
              {!loading && tab === 'entries'
                ? records.map((row, index) => (
                    <Box key={row.id}>
                      {index > 0 ? <Divider /> : null}
                      <Stack spacing={1} sx={{ p: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="subtitle2" noWrap>
                              {row.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                              {row.email}
                            </Typography>
                            <Typography variant="body2">{formatPhone(row.phone)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatWhen(row.createdAt)}
                            </Typography>
                          </Box>
                          {canManage ? (
                            <Stack direction="row" spacing={0.25}>
                              <IconAction title="Edit" icon="solar:pen-bold" onClick={() => openEdit(row)} />
                              <IconAction
                                title="Remove"
                                icon="solar:trash-bin-trash-bold"
                                color="error"
                                onClick={() => setDeleteTarget({ kind: 'entry', id: row.id, name: row.name })}
                              />
                            </Stack>
                          ) : null}
                        </Stack>
                        <PrizeChip label={row.prize?.prizeLabel} isWin={row.prize?.isWin} />
                        <Stack spacing={0.5}>
                          {(row.bills || []).map((bill) => (
                            <Stack key={bill.id} direction="row" spacing={0.25} alignItems="center" sx={{ minWidth: 0 }}>
                              <Typography variant="body2" noWrap title={bill.originalName} sx={{ flex: 1, minWidth: 0 }}>
                                {bill.originalName}
                              </Typography>
                              <IconAction title="View bill" icon="solar:eye-bold" onClick={() => openBill(bill)} />
                              <IconAction title="Download bill" icon="eva:download-outline" onClick={() => downloadBill(bill)} />
                            </Stack>
                          ))}
                        </Stack>
                      </Stack>
                    </Box>
                  ))
                : null}
              {!loading && tab === 'winners'
                ? records.map((row, index) => (
                    <Box key={row.id}>
                      {index > 0 ? <Divider /> : null}
                      <Stack spacing={1} sx={{ p: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="subtitle2" noWrap>
                              {row.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                              {row.email || '—'}
                            </Typography>
                            <Typography variant="body2">{formatPhone(row.phone)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatWhen(row.spunAt)}
                            </Typography>
                          </Box>
                          {canManage ? (
                            <IconAction
                              title="Remove"
                              icon="solar:trash-bin-trash-bold"
                              color="error"
                              onClick={() => setDeleteTarget({ kind: 'winner', id: row.id, name: row.name })}
                            />
                          ) : null}
                        </Stack>
                        <PrizeChip label={row.prizeLabel} isWin />
                      </Stack>
                    </Box>
                  ))
                : null}
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 820 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    {tab === 'entries' ? <TableCell>Submitted</TableCell> : <TableCell>Prize</TableCell>}
                    {tab === 'entries' ? <TableCell>Prize</TableCell> : <TableCell>Won</TableCell>}
                    {tab === 'entries' ? <TableCell>Bills</TableCell> : null}
                    {canManage ? <TableCell align="right">Actions</TableCell> : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loading && records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loading && tab === 'entries'
                    ? records.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{row.name}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.email}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatPhone(row.phone)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatWhen(row.createdAt)}</TableCell>
                          <TableCell>
                            <PrizeChip label={row.prize?.prizeLabel} isWin={row.prize?.isWin} />
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5} alignItems="flex-start">
                              {(row.bills || []).map((bill) => (
                                <Stack key={bill.id} direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" noWrap title={bill.originalName} sx={{ maxWidth: 180 }}>
                                    {bill.originalName}
                                  </Typography>
                                  <IconAction title="View bill" icon="solar:eye-bold" onClick={() => openBill(bill)} />
                                  <IconAction
                                    title="Download bill"
                                    icon="eva:download-outline"
                                    onClick={() => downloadBill(bill)}
                                  />
                                </Stack>
                              ))}
                            </Stack>
                          </TableCell>
                          {canManage ? (
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <IconAction title="Edit" icon="solar:pen-bold" onClick={() => openEdit(row)} />
                                <IconAction
                                  title="Remove"
                                  icon="solar:trash-bin-trash-bold"
                                  color="error"
                                  onClick={() => setDeleteTarget({ kind: 'entry', id: row.id, name: row.name })}
                                />
                              </Stack>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))
                    : null}
                  {!loading && tab === 'winners'
                    ? records.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{row.name}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.email || '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatPhone(row.phone)}</TableCell>
                          <TableCell>{row.prizeLabel}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatWhen(row.spunAt)}</TableCell>
                          {canManage ? (
                            <TableCell align="right">
                              <IconAction
                                title="Remove"
                                icon="solar:trash-bin-trash-bold"
                                color="error"
                                onClick={() => setDeleteTarget({ kind: 'winner', id: row.id, name: row.name })}
                              />
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))
                    : null}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'center', sm: 'center' }}
        >
          <Typography variant="body2" color="text.secondary">
            {info.total || 0} {info.total === 1 ? 'record' : 'records'}
          </Typography>
          <Pagination
            page={page}
            size={isMobile ? 'small' : 'medium'}
            siblingCount={isMobile ? 0 : 1}
            count={info.totalPage || 1}
            onChange={(_event, value) => setPage(value)}
          />
        </Stack>
      </Stack>

      <Dialog open={Boolean(editRow)} onClose={() => setEditRow(null)} fullScreen={isMobile} fullWidth maxWidth="sm">
        <DialogTitle>Edit entry</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Name" value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} />
            <TextField label="Email" value={editForm.email} onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))} />
            <TextField
              label="Phone"
              value={editForm.phone}
              helperText="Include the country code, for example 919876543210."
              onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRow(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullScreen={isMobile} fullWidth maxWidth="xs">
        <DialogTitle>Remove record</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {deleteTarget?.kind === 'winner'
              ? `Remove ${deleteTarget?.name} from the winners list? The form entry stays.`
              : `Remove ${deleteTarget?.name}, the uploaded bills, and the spin result for this entry?`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={saving}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
