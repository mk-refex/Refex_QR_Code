import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { useAuth } from 'src/context/AuthContext';
import { isAdmin } from 'src/utils/roles';

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

export default function WinterCampaignReview() {
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

  const openBill = async (bill) => {
    const res = await axios.get(`/api/winter-campaign/bills/${bill.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
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

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="h4">Winter Campaign</Typography>
          <Typography variant="body2" color="text.secondary">
            Submitted customer details, purchase bills, and winners.
            {canManage ? ' Admins can edit or remove records.' : ' This role can view records.'}
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Tabs
            value={tab}
            onChange={(_event, value) => {
              setTab(value);
              setPage(1);
            }}
          >
            <Tab value="entries" label="Entries" />
            <Tab value="winners" label="Winners" />
          </Tabs>
          <Box sx={{ flex: 1 }} />
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setPage(1);
                setQuery(search.trim());
              }
            }}
          />
          <Button
            variant="contained"
            onClick={() => {
              setPage(1);
              setQuery(search.trim());
            }}
          >
            Search
          </Button>
        </Stack>

        {error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : null}

        <Card>
          <TableContainer>
            <Table>
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
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{formatPhone(row.phone)}</TableCell>
                        <TableCell>{formatWhen(row.createdAt)}</TableCell>
                        <TableCell>
                          {row.prize ? (
                            <Chip
                              size="small"
                              label={row.prize.prizeLabel}
                              color={row.prize.isWin ? 'success' : 'default'}
                            />
                          ) : (
                            'Not spun'
                          )}
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0.5} alignItems="flex-start">
                            {(row.bills || []).map((bill) => (
                              <Button key={bill.id} size="small" onClick={() => openBill(bill)}>
                                {bill.originalName}
                              </Button>
                            ))}
                          </Stack>
                        </TableCell>
                        {canManage ? (
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                onClick={() => {
                                  setEditRow(row);
                                  setEditForm({ name: row.name, email: row.email, phone: row.phone });
                                }}
                              >
                                Edit
                              </Button>
                              <Button size="small" color="error" onClick={() => setDeleteTarget({ kind: 'entry', id: row.id, name: row.name })}>
                                Remove
                              </Button>
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
                        <TableCell>{row.email || '—'}</TableCell>
                        <TableCell>{formatPhone(row.phone)}</TableCell>
                        <TableCell>{row.prizeLabel}</TableCell>
                        <TableCell>{formatWhen(row.spunAt)}</TableCell>
                        {canManage ? (
                          <TableCell align="right">
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setDeleteTarget({ kind: 'winner', id: row.id, name: row.name })}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {info.total || 0} {info.total === 1 ? 'record' : 'records'}
          </Typography>
          <Pagination
            page={page}
            count={info.totalPage || 1}
            onChange={(_event, value) => setPage(value)}
          />
        </Stack>
      </Stack>

      <Dialog open={Boolean(editRow)} onClose={() => setEditRow(null)} fullWidth maxWidth="sm">
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

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
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
