import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Clock, Calendar, User, Paperclip, Send } from "lucide-react";
import { useState } from "react";
import UserAvatar from "./UserAvatar";
import StatusBadge, { TaskStatus } from "./StatusBadge";
import RatingDisplay from "./RatingDisplay";

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    type: "individual" | "auction";
    creator: string;
    assignee?: string;
    deadline: string;
    estimatedHours: number;
    actualHours?: number;
    rating?: number;
    comments: Comment[];
  };
}

export default function TaskDetailDialog({ open, onOpenChange, task }: TaskDetailDialogProps) {
  const [newComment, setNewComment] = useState("");

  if (!task) return null;

  const handleSendComment = () => {
    if (newComment.trim()) {
      console.log("Sending comment:", newComment);
      setNewComment("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" data-testid="dialog-task-detail">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="flex-1">{task.title}</DialogTitle>
            <StatusBadge status={task.status} />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2">
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-4">Comments ({task.comments.length})</h3>
              <ScrollArea className="h-64">
                <div className="space-y-4">
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <UserAvatar name={comment.author} size="sm" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{comment.author}</span>
                          <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-4 flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  data-testid="textarea-comment"
                />
                <div className="flex flex-col gap-2">
                  <Button size="icon" variant="outline" data-testid="button-attach-file">
                    <Paperclip size={18} />
                  </Button>
                  <Button size="icon" onClick={handleSendComment} data-testid="button-send-comment">
                    <Send size={18} />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-md bg-card border space-y-3">
              <h3 className="font-semibold">Details</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Creator:</span>
                  <span className="font-medium">{task.creator}</span>
                </div>

                {task.assignee && (
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-muted-foreground" />
                    <span className="text-muted-foreground">Assignee:</span>
                    <span className="font-medium">{task.assignee}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Deadline:</span>
                  <span className="font-medium font-mono">{task.deadline}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium font-mono">
                    {task.actualHours ? `${task.actualHours}/${task.estimatedHours}h` : `${task.estimatedHours}h`}
                  </span>
                </div>

                {task.rating && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Rating:</span>
                    <RatingDisplay rating={task.rating} size="sm" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Button className="w-full" data-testid="button-start-task">
                Start Task
              </Button>
              <Button variant="outline" className="w-full" data-testid="button-log-time">
                Log Time
              </Button>
              {task.status === "inProgress" && (
                <Button variant="outline" className="w-full" data-testid="button-submit-review">
                  Submit for Review
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
