import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, Lock, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type HouseholdMember = { id: string; name: string; pin?: string };
const MEMBERS_KEY = "homebase_members";

function loadMembers(): HouseholdMember[] {
  try {
    return JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
  } catch {
    return [];
  }
}

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    setMembers(loadMembers());
  }, []);

  const selectedMember = members.find((m) => m.id === selectedId);
  const needsPin = selectedMember?.pin && selectedMember.pin.length > 0;

  const handleLogin = () => {
    if (!selectedId) {
      toast({ title: "Please select a household member", variant: "destructive" });
      return;
    }
    const success = login(selectedId, pin);
    if (success) {
      navigate("/dashboard", { replace: true });
    } else {
      toast({ title: "Incorrect PIN", variant: "destructive" });
      setPin("");
    }
  };

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
              No household members found. Head to the Chores page first to add members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/chores")}>
              Go to Chores
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
