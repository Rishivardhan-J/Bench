import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, CheckCheck, Paperclip, Send, X } from 'lucide-react';
import { Page, usePageTitle } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Menu } from '@/components/ui/Menu';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { errorMessage } from '@/lib/data/api';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  blockUser,
  markThreadRead,
  sendMessage,
  uploadAttachment,
  useMessages,
  useThreads,
} from '@/lib/data/messaging';
import { detectOffPlatform, OFF_PLATFORM_COPY } from '@/lib/offPlatform';
import { formatBytes, formatClock, formatRelative } from '@/lib/format';
import { ReportDialog } from '@/features/profile/ReportDialog';
import type { Attachment, Message, Thread } from '@/types';

const ThreadList: React.FC<{ threads: Thread[]; uid: string; activeId?: string }> = ({ threads, uid, activeId }) => (
  <ul aria-label="Conversations" className="flex flex-col">
    {threads.map((t) => {
      const otherUid = t.participants.find((p) => p !== uid) ?? '';
      const name = t.names[otherUid] ?? 'Conversation';
      const unread = t.unread[uid] ?? 0;
      return (
        <li key={t.id}>
          <Link
            to={`/messages/${t.id}`}
            aria-current={activeId === t.id ? 'page' : undefined}
            className={`flex items-center gap-12 px-16 py-12 border-b border-border transition-colors duration-120 ${activeId === t.id ? 'bg-surface-3' : 'hover:bg-surface-2'}`}
          >
            <Avatar name={name} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-8">
                <span className={`text-body truncate ${unread > 0 ? 'font-semibold text-text' : 'text-text'}`}>{name}</span>
                <span className="text-11 text-text-dim whitespace-nowrap">{formatRelative(t.lastMessageAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-8">
                <span className="text-meta text-text-dim truncate">{t.lastMessage ?? 'No messages yet'}</span>
                {unread > 0 && (
                  <span className="flex-shrink-0 inline-flex items-center justify-center min-w-16 h-16 px-4 rounded-full bg-accent text-11 font-mono tabular-nums text-bg" aria-label={`${unread} unread`}>{unread}</span>
                )}
              </div>
            </div>
          </Link>
        </li>
      );
    })}
  </ul>
);

const Bubble: React.FC<{ m: Message; mine: boolean; read: boolean; onRetry?: () => void }> = ({ m, mine, read }) => (
  <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
    <div className={`max-w-prose rounded-lg px-16 py-12 ${mine ? 'bg-text text-bg' : 'bg-surface-2 text-text'}`}>
      {m.text && <p className="text-body whitespace-pre-wrap break-words">{m.text}</p>}
      {m.attachments.length > 0 && (
        <ul className={`flex flex-col gap-8 ${m.text ? 'mt-8' : ''}`}>
          {m.attachments.map((a) => (
            <li key={a.path}>
              {a.type.startsWith('image/') ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="block rounded-md overflow-hidden">
                  <img src={a.url} alt={a.name} loading="lazy" className="max-h-200 rounded-md" />
                </a>
              ) : (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-8 underline underline-offset-4 text-meta">
                  <Paperclip className="w-12 h-12" aria-hidden="true" />{a.name} <span className="opacity-75">({formatBytes(a.size)})</span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className={`flex items-center justify-end gap-4 mt-4 text-11 ${mine ? 'text-bg' : 'text-text-dim'}`}>
        {formatClock(m.createdAt)}
        {mine && (m.pending ? <span className="sr-only">Sending</span> : read ? <CheckCheck className="w-12 h-12 text-text-mute" aria-label="Read" /> : <Check className="w-12 h-12 text-text-mute" aria-label="Sent" />)}
      </p>
    </div>
  </li>
);

const Conversation: React.FC<{ thread: Thread; uid: string }> = ({ thread, uid }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: messages, loading, error } = useMessages(thread.id);
  const [text, setText] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [sending, setSending] = React.useState(false);
  const [failed, setFailed] = React.useState<{ text: string; files: File[] } | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const otherUid = thread.participants.find((p) => p !== uid) ?? '';
  const otherName = thread.names[otherUid] ?? 'Conversation';
  const otherReadAt = thread.lastRead[otherUid] ?? 0;
  const unreadMine = thread.unread[uid] ?? 0;

  usePageTitle(otherName);

  // Mark as read whenever new messages arrive while this conversation is open.
  React.useEffect(() => {
    if (unreadMine > 0) void markThreadRead(thread.id, uid).catch(() => undefined);
  }, [unreadMine, thread.id, uid]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  // First exchange: warn about off-platform contact details (T5).
  const early = messages.filter((m) => m.senderUid === uid).length < 3;
  const warning = early ? detectOffPlatform(text) : null;

  const deliver = async (body: string, toSend: File[]) => {
    setSending(true);
    setFailed(null);
    try {
      const attachments: Attachment[] = [];
      for (const f of toSend) attachments.push(await uploadAttachment(thread.id, f));
      await sendMessage(thread.id, uid, body, attachments);
    } catch (err) {
      setFailed({ text: body, files: toSend });
      toast(errorMessage(err, "Message not sent. Check your connection and retry."));
    } finally {
      setSending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && files.length === 0) || thread.closed) return;
    const body = text;
    const toSend = files;
    setText('');
    setFiles([]);
    await deliver(body, toSend);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    const ok = picked.filter((f) => {
      if (f.size > ATTACHMENT_MAX_BYTES) {
        toast(`${f.name} is larger than ${formatBytes(ATTACHMENT_MAX_BYTES)}.`);
        return false;
      }
      return true;
    });
    setFiles((cur) => [...cur, ...ok].slice(0, 5));
  };

  const doBlock = async () => {
    try {
      await blockUser({ targetUid: otherUid });
      toast(`${otherName} was blocked.`);
      navigate('/messages');
    } catch (err) {
      toast(errorMessage(err));
    }
    setBlockOpen(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-12 px-16 py-12 border-b border-border">
        <Link to="/messages" aria-label="Back to conversations" className="lg:hidden inline-flex items-center justify-center w-32 h-32 rounded-md text-text-dim hover:text-text"><ArrowLeft className="w-16 h-16" aria-hidden="true" /></Link>
        <Avatar name={otherName} size="lg" />
        <h1 className="flex-1 text-body font-semibold text-text truncate">{otherName}</h1>
        <Menu
          label="Conversation actions"
          trigger={<span className="inline-flex items-center justify-center w-32 h-32 rounded-md text-text-dim hover:text-text" aria-hidden="true">···</span>}
          items={[
            { label: 'Report conversation', onSelect: () => setReportOpen(true) },
            { label: 'Block this person', onSelect: () => setBlockOpen(true) },
          ]}
        />
      </header>

      <div className="flex-1 overflow-y-auto p-16 min-h-0" role="log" aria-live="polite" aria-label={`Messages with ${otherName}`}>
        {error ? (
          <ErrorState message="We couldn't load this conversation." />
        ) : loading ? (
          <div aria-busy="true" className="flex flex-col gap-12"><span className="sr-only" role="status">Loading messages</span><Skeleton className="h-48 w-2/3" /><Skeleton className="h-48 w-1/2 self-end" /><Skeleton className="h-48 w-3/5" /></div>
        ) : (
          <ul className="flex flex-col gap-8">
            {messages.map((m) => (
              <Bubble key={m.id} m={m} mine={m.senderUid === uid} read={Boolean(m.createdAt && m.createdAt <= otherReadAt)} />
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {failed && (
        <div role="alert" className="mx-16 mb-8 flex items-center justify-between gap-12 p-12 rounded-md border border-border-strong bg-surface-2 text-meta text-text">
          Your last message wasn't sent.
          <Button size="sm" variant="secondary" onClick={() => deliver(failed.text, failed.files)}>Retry</Button>
        </div>
      )}

      {thread.closed ? (
        <p role="status" className="p-16 border-t border-border text-body text-text-dim text-center">This conversation is closed. Neither side can send new messages.</p>
      ) : (
        <form onSubmit={submit} className="border-t border-border p-12 flex flex-col gap-8">
          {warning && <p role="status" className="p-8 rounded-sm bg-surface-2 border border-border text-meta text-text-dim">{OFF_PLATFORM_COPY[warning]}</p>}
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-8" aria-label="Attachments to send">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="inline-flex items-center gap-8 pl-8 pr-4 py-4 rounded-sm bg-surface-3 border border-border text-meta text-text">
                  {f.name} <span className="text-text-dim">({formatBytes(f.size)})</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="inline-flex items-center justify-center w-16 h-16 rounded-badge text-text-dim hover:text-text"><X className="w-12 h-12" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-8">
            <input ref={fileRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Attach files" onChange={onPick} />
            <button type="button" aria-label="Attach a file" onClick={() => fileRef.current?.click()} className="inline-flex items-center justify-center w-40 h-40 rounded-md text-text-dim hover:text-text hover:bg-surface-2"><Paperclip className="w-16 h-16" aria-hidden="true" /></button>
            <textarea
              aria-label={`Message ${otherName}`}
              value={text}
              rows={1}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Write a message. Enter to send, Shift+Enter for a new line."
              className="flex-1 min-h-40 max-h-120 resize-none rounded-md border border-border bg-surface px-12 py-8 text-body text-text placeholder:text-text-mute hover:border-border-strong focus:border-border-strong"
            />
            <Button type="submit" aria-label="Send message" loading={sending} disabled={!text.trim() && files.length === 0}><Send className="w-16 h-16" aria-hidden="true" /></Button>
          </div>
        </form>
      )}

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="message" targetId={thread.id} label="this conversation" />
      <Dialog open={blockOpen} onClose={() => setBlockOpen(false)} title={`Block ${otherName}?`} description="They won't be able to message you or send requests. This conversation will be closed.">
        <div className="flex justify-end gap-8"><Button variant="ghost" onClick={() => setBlockOpen(false)}>Cancel</Button><Button onClick={doBlock}><Ban className="w-16 h-16" aria-hidden="true" />Block</Button></div>
      </Dialog>
    </div>
  );
};

export const MessagesPage: React.FC = () => {
  usePageTitle('Messages');
  const { threadId } = useParams<{ threadId: string }>();
  const { currentUser, isAuthLoading, openSignInModal } = useAuth();
  const uid = currentUser?.uid ?? null;
  const { data: threads, loading, error } = useThreads(uid);
  const active = threads.find((t) => t.id === threadId);

  if (!isAuthLoading && !currentUser) {
    return (
      <Page width="narrow">
        <EmptyState title="Sign in to see your messages" message="Messages are private between you and the other person." action={<Button onClick={() => openSignInModal({ mode: 'signin' })}>Sign in</Button>} />
      </Page>
    );
  }
  if (!uid) return null;

  return (
    <div className="max-w-page mx-auto px-0 sm:px-24 py-0 sm:py-24">
      <div className="grid lg:grid-cols-inbox border-y sm:border border-border sm:rounded-lg bg-surface overflow-hidden h-inbox min-h-320">
        <div className={`${threadId ? 'hidden lg:block' : 'block'} border-r border-border overflow-y-auto`}>
          <h1 className="px-16 py-16 text-section-heading text-text border-b border-border">Messages</h1>
          {error ? (
            <ErrorState message="We couldn't load your messages." />
          ) : loading ? (
            <div aria-busy="true" className="p-16 flex flex-col gap-12"><span className="sr-only" role="status">Loading conversations</span><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>
          ) : threads.length === 0 ? (
            <EmptyState message="No conversations yet. When a connect request is accepted, you can message here." />
          ) : (
            <ThreadList threads={threads} uid={uid} activeId={threadId} />
          )}
        </div>
        <div className={`${threadId ? 'block' : 'hidden lg:flex'} min-h-0 min-w-0 flex-col`}>
          {active ? (
            <Conversation key={active.id} thread={active} uid={uid} />
          ) : threadId && !loading ? (
            <EmptyState className="h-full" title="Conversation not found" message="It may have been removed, or you may not have access." />
          ) : (
            <EmptyState className="h-full hidden lg:flex" message="Select a conversation to start messaging." />
          )}
        </div>
      </div>
    </div>
  );
};
