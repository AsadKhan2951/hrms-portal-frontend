import { useState } from "react";
import { MessageSquare, X, Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format } from "date-fns";

export function GlobalChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const { user } = useAuth();

  const { data: messages } = trpc.chat.getMessages.useQuery({}, {
    enabled: isOpen,
    refetchInterval: isOpen ? 3000 : false,
  });

  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      setMessage("");
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate({ message: message });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-premium-lg bg-[#ff2801] hover:bg-[#e62401] text-white"
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 z-50 w-96 h-[500px] shadow-premium-lg flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-[#ff2801] text-white rounded-t-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Team Chat
            </h3>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    String(msg.senderId) === String(user?.id) ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      String(msg.senderId) === String(user?.id)
                        ? "bg-[#ff2801] text-white"
                        : "bg-muted"
                    }`}
                  >
                    {String(msg.senderId) !== String(user?.id) && msg.sender && (
                      <p className="text-xs font-medium mb-1">{msg.sender.name}</p>
                    )}
                    <p className="text-sm">{msg.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {format(new Date(msg.createdAt), "HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!message.trim()}
                className="bg-[#ff2801] hover:bg-[#e62401]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
