"use client";

import { useRouter } from "next/navigation";

import { CircleUser, EllipsisVertical, LogOut, ShieldCheck } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-store";
import { getRoleLabel } from "@/lib/inuka-pulse/roles";
import { deleteClientCookie } from "@/lib/cookie.client";

export function NavUser() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const { user, clearUser } = useAuthStore(
    useShallow((s) => ({ user: s.user, clearUser: s.clearUser })),
  );

  // Fallback while store hydrates on first render
  const displayName  = user?.name  ?? "Inuka User";
  const displayEmail = user?.email ?? "";
  const displayRole  = user?.role  ?? "";
  const roleLabel    = getRoleLabel(displayRole);

  const handleLogout = () => {
    clearUser();
    // Clear the SSR cookie so server components no longer see a stale token
    deleteClientCookie("inuka-token");
    router.push("/auth/v2/login");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={undefined} alt={displayName} />
                <AvatarFallback className="rounded-lg">{getInitials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-muted-foreground text-xs">{displayEmail}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* User identity block */}
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={undefined} alt={displayName} />
                  <AvatarFallback className="rounded-lg">{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight gap-0.5">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-muted-foreground text-xs">{displayEmail}</span>
                  {roleLabel && (
                    <Badge
                      variant="outline"
                      className="mt-1 w-fit text-[10px] px-1.5 py-0 flex items-center gap-1"
                    >
                      <ShieldCheck className="size-2.5" />
                      {roleLabel}
                    </Badge>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/dashboard/users")}>
                <CircleUser />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
