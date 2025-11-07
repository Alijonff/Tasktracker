import TimeLogDialog from '../TimeLogDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function TimeLogDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Time Log</Button>
      <TimeLogDialog 
        open={open} 
        onOpenChange={setOpen} 
        taskTitle="Implement user authentication"
      />
    </div>
  );
}
