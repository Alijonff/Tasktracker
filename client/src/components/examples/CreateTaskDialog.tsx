import CreateTaskDialog from '../CreateTaskDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function CreateTaskDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Create Task Dialog</Button>
      <CreateTaskDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
