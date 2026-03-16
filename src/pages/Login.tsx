import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, Lock, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api, ApiMember } from "@/lib/api";

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const { data: members = [], isLoading, isError, refetch } = useQuery<ApiMember[]>({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
    retry: 1,
  });

  const selectedMember = members.find((m) => m.id === selectedId);
  const needsPin = selectedMember?.pin && selectedMember.pin.length > 0;

  const handleLogin = () => {
    if (!selectedId || !selectedMember) {
      toast({ title: "Please select a household member", variant: "destructive" });
      return;
    }
    if (selectedMember.pin && selectedMember.pin !== pin) {
      toast({ title: "Incorrect PIN", variant: "destructive" });
      setPin("");
      return;
    }
    if (!selectedMember.pin && pin !== "") {
      toast({ title: "Incorrect PIN", variant: "destructive" });
      setPin("");
      return;
    }
    login(selectedMember);
    navigate("/dashboard", { replace: true });
  };

  const [setupName, setSetupName] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  const handleSetup = async () => {
    const name = setupName.trim();
    if (!name) return;
    setSetupLoading(true);
    try {
      const member = await api.createMember(name, setupPin.trim() || undefined);
      await refetch();
      setSetupName("");
      setSetupPin("");
      toast({ title: `${member.name} added! You can now sign in.` });
    } catch {
      // Fallback: create member locally and auto-login
      const member: ApiMember = {
        id: crypto.randomUUID(),
        name,
        pin: setupPin.trim() || null,
      };
      login(member);
      navigate("/dashboard", { replace: true });
    } finally {
      setSetupLoading(false);
    }
  };

  if (isLoading && !isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm shadow-[var(--card-shadow)]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Home className="h-6 w-6" />
            </div>
            <CardTitle className="font-serif text-2xl">HomeBase</CardTitle>
            <CardDescription>
              Welcome! Create your first household member to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Your name</Label>
              <Input
                placeholder="e.g. Alex"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetup()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> PIN (optional)
              </Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Set a numeric PIN"
                value={setupPin}
                onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleSetup()}
              />
            </div>
            <Button
              className="w-full gap-1.5"
              onClick={handleSetup}
              disabled={!setupName.trim() || setupLoading}
            >
              <UserPlus className="h-4 w-4" /> Create & Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm shadow-[var(--card-shadow)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Home className="h-6 w-6" />
          </div>
          <CardTitle className="font-serif text-2xl">HomeBase</CardTitle>
          <CardDescription>Select your name and enter your PIN to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Who are you?</Label>
            <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setPin(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose member…" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedId && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> PIN
              </Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder={needsPin ? "Enter your PIN" : "No PIN set — leave blank"}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
          )}

          <Button className="w-full gap-1.5" onClick={handleLogin} disabled={!selectedId}>
            <LogIn className="h-4 w-4" /> Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
