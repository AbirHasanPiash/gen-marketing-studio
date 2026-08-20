import { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
import { Modal, Button, Textarea } from '../ui';

/**
 * "Request changes" dialog for the post approval flow. The reason is optional —
 * the API falls back to "No reason provided" — but the author only sees what is
 * typed here, so it's worth filling in.
 */
export function RejectDialog({ open, onClose, onSubmit, loading, subtitle = 'The author sees this note on the post.' }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request changes"
      subtitle={subtitle}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => onSubmit(reason.trim())} loading={loading}>
            <XCircle className="h-4 w-4" /> Request changes
          </Button>
        </>
      }
    >
      <Textarea
        autoFocus
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What needs to change before this can be approved?"
      />
    </Modal>
  );
}

export default RejectDialog;
