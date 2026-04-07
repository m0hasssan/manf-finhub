import { useState } from "react";
import { Bell, Search, User, LogOut, Palette, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useRecentLogs, getActionLabel, getEntityLabel } from "@/hooks/useActionLog";
import { useNotificationBadges } from "@/hooks/useNotificationBadges";
import { useTheme, themeLabels, type ThemeVariant } from "@/hooks/useTheme";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Header() {
  const { user, signOut } = useAuth();
  const { data: rawLogs } = useRecentLogs(20);
  const { unseenBellCount, markBellSeen } = useNotificationBadges();
  
  // Filter out current user's own actions and logs before account creation
  const recentLogs = rawLogs?.filter(log => {
    if (log.user_id === user?.id) return false;
    if (user?.created_at && log.created_at < user.created_at) return false;
    return true;
  }).slice(0, 10);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNotificationsOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      markBellSeen();
    }
  };

  const themes: { value: ThemeVariant; icon: typeof Sun }[] = [
    { value: "light-purple", icon: Sun },
    { value: "light-green", icon: Sun },
    { value: "dark-purple", icon: Moon },
    { value: "dark-green", icon: Moon },
  ];

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      {/* Search */}
      <div className="relative w-96">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث في النظام..."
          className="pr-10 bg-muted/50"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Popover open={open} onOpenChange={handleNotificationsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {unseenBellCount > 0 && (
                <span className="absolute -top-1 -left-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  {unseenBellCount > 9 ? "9+" : unseenBellCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="end">
            <div className="p-3 border-b border-border">
              <h3 className="font-semibold text-sm">الإشعارات</h3>
            </div>
            <ScrollArea className="max-h-80">
              {!recentLogs || recentLogs.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  لا توجد إشعارات حديثة
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{log.user_name}</span>
                            {" قام بـ "}
                            <Badge variant="outline" className="text-xs mx-1">
                              {getActionLabel(log.action)}
                            </Badge>
                            {" "}
                            <span className="text-muted-foreground">
                              {getEntityLabel(log.entity_type)}
                            </span>
                            {log.entity_name && (
                              <span className="font-medium"> - {log.entity_name}</span>
                            )}
                          </p>
                          {log.details && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{log.details}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "HH:mm", { locale: ar })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="p-2 border-t border-border">
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  setOpen(false);
                  navigate("/action-logs");
                }}
              >
                عرض الجميع
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 pr-4 border-r border-border cursor-pointer hover:opacity-80 transition-opacity">
              <div className="text-left">
                <p className="text-sm font-medium">{user?.user_metadata?.full_name || user?.email}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-primary-foreground" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              تغيير الثيم
            </DropdownMenuLabel>
            {themes.map((t) => (
              <DropdownMenuItem
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={theme === t.value ? "bg-accent" : ""}
              >
                <t.icon className="w-4 h-4 ml-2" />
                {themeLabels[t.value]}
                {theme === t.value && <span className="mr-auto text-xs text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="w-4 h-4 ml-2" />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
