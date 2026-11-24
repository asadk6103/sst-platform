import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Eye, History, RotateCcw, Send, Undo2, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, fmtDate, Loading, Modal, StatusBadge, useFeedback } from './ui';

export interface WorkflowInfo {
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  isLive: boolean;
  hasPendingChanges: boolean;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
}

/**
 * Status + actions for a workflow-managed item.
 * Draft → Submitted for review → Approved → Published (now or scheduled).
 */
export function WorkflowPanel({ module, id, workflow, publicPath, dirty, onChanged }: { module: string; id: string; workflow: WorkflowInfo; publicPath?: string | null; dirty?: boolean; onChanged: () => void }) {
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | 'reject' | 'approve' | 'schedule' | 'history'>(null);
  const [comment, setComment] = useState('');
  const [when, setWhen] = useState('');

  const act = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: any }) => api.post(`/admin/${module}/${id}/${action}`, body ?? {}),
    onSuccess: (_d, v) => {
      const msg: Record<string, string> = { submit: 'Submitted for review', approve: 'Approved', reject: 'Rejected — the author has been sent your comments', publish: 'Published to the website', unpublish: 'Removed from the website' };
      toast(v.body?.scheduledPublishAt ? `Scheduled for ${fmtDate(v.body.scheduledPublishAt, true)}` : msg[v.action] ?? 'Done');
      setModal(null);
      setComment('');
      qc.invalidateQueries({ queryKey: [module] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      onChanged();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const preview = async () => {
    try {
      const { url } = await api.post<{ url: string }>(`/admin/${module}/${id}/preview`);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const s = workflow.status;
  const canSubmit = can('workflow.submit') && (s === 'DRAFT' || s === 'REJECTED');
  const canReview = can('workflow.review') && s === 'IN_REVIEW';
  const canPublish = can('workflow.publish') && (s === 'APPROVED' || (s === 'IN_REVIEW' && can('workflow.review')));
  const busy = act.isPending;
  const blockIfDirty = (fn: () => void) => () => (dirty ? toast('Save your changes first', 'info') : fn());

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Publishing</h3>
        <StatusBadge status={s} isLive={workflow.isLive} hasPendingChanges={workflow.hasPendingChanges} scheduledPublishAt={workflow.scheduledPublishAt} />
      </div>
      <dl className="mb-4 space-y-1 text-xs text-slate-500">
        <div className="flex justify-between"><dt>Live on website</dt><dd className="font-medium text-slate-700">{workflow.isLive ? 'Yes' : 'No'}</dd></div>
        <div className="flex justify-between"><dt>Last published</dt><dd>{fmtDate(workflow.publishedAt, true)}</dd></div>
        {workflow.scheduledPublishAt && <div className="flex justify-between"><dt>Scheduled</dt><dd className="font-medium text-violet-700">{fmtDate(workflow.scheduledPublishAt, true)}</dd></div>}
      </dl>
      {workflow.hasPendingChanges && <p className="mb-3 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">The website shows the last published version. Your saved changes go live after approval and publishing.</p>}
      {workflow.reviewComment && (s === 'REJECTED' || s === 'APPROVED') && (
        <div className={`mb-3 rounded px-2 py-1.5 text-xs ${s === 'REJECTED' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
          <span className="font-semibold">Reviewer:</span> {workflow.reviewComment}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {canSubmit && <Button icon={<Send className="h-4 w-4" />} loading={busy} onClick={blockIfDirty(() => act.mutate({ action: 'submit' }))}>Submit for review</Button>}
        {canReview && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} onClick={() => setModal('approve')}>Approve</Button>
            <Button variant="secondary" icon={<XCircle className="h-4 w-4 text-red-600" />} onClick={() => setModal('reject')}>Reject</Button>
          </div>
        )}
        {can('workflow.review') && s === 'APPROVED' && <Button variant="ghost" size="sm" onClick={() => setModal('reject')}>Send back with comments</Button>}
        {canPublish && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="gold" loading={busy} onClick={blockIfDirty(async () => (await confirm({ title: 'Publish to the website?', text: 'Visitors will see this version immediately.', confirmLabel: 'Publish' })) && act.mutate({ action: 'publish' }))}>Publish now</Button>
            <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={blockIfDirty(() => setModal('schedule'))}>Schedule</Button>
          </div>
        )}
        {can('workflow.publish') && workflow.isLive && (
          <Button variant="ghost" size="sm" icon={<Undo2 className="h-4 w-4" />} onClick={async () => (await confirm({ title: 'Unpublish?', text: 'This removes the item from the public website. You can publish it again later.', confirmLabel: 'Unpublish', danger: true })) && act.mutate({ action: 'unpublish' })}>
            Unpublish
          </Button>
        )}
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          {publicPath ? <Button variant="secondary" size="sm" icon={<Eye className="h-4 w-4" />} onClick={blockIfDirty(preview)}>Preview</Button> : <span />}
          {can('revisions.view') && <Button variant="secondary" size="sm" icon={<History className="h-4 w-4" />} onClick={() => setModal('history')}>History</Button>}
        </div>
      </div>

      <Modal
        open={modal === 'approve' || modal === 'reject'}
        onClose={() => setModal(null)}
        title={modal === 'approve' ? 'Approve content' : 'Reject content'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant={modal === 'reject' ? 'danger' : 'primary'} loading={busy} disabled={modal === 'reject' && !comment.trim()} onClick={() => act.mutate({ action: modal!, body: { comment: comment || undefined } })}>
              {modal === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <label className="label" htmlFor="wf-comment">Comments for the author {modal === 'reject' ? '(required)' : '(optional)'}</label>
        <textarea id="wf-comment" className="input" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>

      <Modal
        open={modal === 'schedule'}
        onClose={() => setModal(null)}
        title="Schedule publication"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={busy} disabled={!when || new Date(when) <= new Date()} onClick={() => act.mutate({ action: 'publish', body: { scheduledPublishAt: new Date(when).toISOString() } })}>Schedule</Button>
          </>
        }
      >
        <label className="label" htmlFor="wf-when">Publish on</label>
        <input id="wf-when" type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
        <p className="mt-2 text-xs text-slate-500">The content is approved now and goes live automatically at this time (checked every 30 seconds).</p>
      </Modal>

      {modal === 'history' && <HistoryModal module={module} id={id} onClose={() => setModal(null)} onRestored={onChanged} />}
    </div>
  );
}

function HistoryModal({ module, id, onClose, onRestored }: { module: string; id: string; onClose: () => void; onRestored: () => void }) {
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const q = useQuery({ queryKey: [module, id, 'revisions'], queryFn: () => api.get<{ revisions: any[]; publicationLog: any[] }>(`/admin/${module}/${id}/revisions`) });
  const [view, setView] = useState<any>(null);
  const restore = async (rev: any) => {
    if (!(await confirm({ title: `Restore version ${rev.version}?`, text: 'The working copy will be replaced with this version as a draft. The live website is not changed until it is published again.', confirmLabel: 'Restore' }))) return;
    try {
      await api.post(`/admin/${module}/${id}/revisions/${rev.id}/restore`);
      toast(`Version ${rev.version} restored as a draft`);
      onRestored();
      onClose();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  return (
    <Modal open onClose={onClose} title="Revision history" wide>
      {q.isLoading ? (
        <Loading />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Versions</h4>
            <ol className="space-y-2">
              {q.data?.revisions.map((r) => (
                <li key={r.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{r.version} <Badge tone={r.action === 'PUBLISH' ? 'green' : r.action === 'RESTORE' ? 'purple' : 'slate'}>{r.action.toLowerCase()}</Badge></span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setView(r)}>View</Button>
                      {can('revisions.restore') && <Button size="sm" variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => restore(r)}>Restore</Button>}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{fmtDate(r.createdAt, true)} · {r.createdByName ?? 'Unknown'}{r.comment ? ` · ${r.comment}` : ''}</p>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Workflow activity</h4>
            {!q.data?.publicationLog.length && <p className="text-sm text-slate-500">No workflow activity yet.</p>}
            <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
              {q.data?.publicationLog.map((l) => (
                <li key={l.id} className="text-sm">
                  <p><span className="font-medium">{l.action.toLowerCase()}</span> <span className="text-slate-400">by</span> {l.userName ?? 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{fmtDate(l.createdAt, true)}</p>
                  {l.comment && <p className="mt-0.5 text-xs italic text-slate-600">“{l.comment}”</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      <Modal open={!!view} onClose={() => setView(null)} title={`Version ${view?.version}`} wide>
        <pre className="max-h-[60vh] overflow-auto rounded bg-slate-900 p-4 text-xs text-slate-100">{JSON.stringify(view?.data, null, 2)}</pre>
      </Modal>
    </Modal>
  );
}
