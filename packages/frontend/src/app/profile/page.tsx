"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConnectButton } from "@/components/connect-button";
import { AgentCard } from "@/components/agent-card";
import { Wallet, Gift, Plus, Dna } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const [isClaimingRoyalties, setIsClaimingRoyalties] = useState(false);

  // Contracts not yet deployed — show 0 / deploying state
  const ownedAgents: Array<{
    tokenId: string;
    name: string;
    elo: number;
    wins: number;
    losses: number;
    generation: number;
    owner: string;
  }> = [];
  const pendingRoyalties = 0;

  const handleClaimRoyalties = async () => {
    setIsClaimingRoyalties(true);
    try {
      // Will call RoyaltyVault.claim(address) once deployed
      throw new Error("NOT_IMPLEMENTED: waiting on RoyaltyVault contract deploy");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setIsClaimingRoyalties(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.05) 0%, transparent 60%)",
        }}
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[#7c3aed] font-mono text-xl animate-agent-pulse">◢◤</span>
            <span className="text-xl font-bold tracking-tight text-[#ededed]">AgentForge</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/agents" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Gallery</Link>
            <Link href="/arena" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Arena</Link>
            <Link href="/breed" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Breed</Link>
            <Link href="/mint" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Mint</Link>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16 space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <p className="text-xs font-mono text-[#10b981] uppercase tracking-widest">Profile</p>
            <h1 className="text-5xl font-black text-[#ededed] tracking-tight">My Agents</h1>
            <p className="text-[#6b7280]">Manage your forged agents and breeding royalties.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/mint">
              <Button className="bg-[#7c3aed] hover:bg-[#5b21b6] text-white rounded-xl font-semibold transition-all hover:-translate-y-[2px]">
                <Plus className="w-4 h-4 mr-2" />
                Mint Agent
              </Button>
            </Link>
            <Link href="/breed">
              <Button className="bg-white/[0.03] border border-white/[0.08] text-[#ededed] hover:bg-white/[0.06] rounded-xl font-semibold">
                <Dna className="w-4 h-4 mr-2" />
                Breed
              </Button>
            </Link>
          </div>
        </div>

        {/* Royalties Card */}
        <div className="glass-card rounded-2xl p-8 border border-[#10b981]/20">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#10b981]" />
                <h2 className="text-lg font-bold text-[#ededed]">Breeding Royalties</h2>
              </div>
              <p className="text-5xl font-black text-[#10b981] font-mono">
                {pendingRoyalties}
                <span className="text-xl text-[#6b7280] ml-2">0G</span>
              </p>
              <p className="text-xs text-[#6b7280] font-mono">
                Earned from offspring breeding fees · RoyaltyVault.pending(address)
              </p>
            </div>
            <Button
              onClick={handleClaimRoyalties}
              disabled={isClaimingRoyalties || pendingRoyalties === 0}
              className="bg-[#10b981] hover:bg-[#059669] text-black font-bold rounded-xl px-8 py-3 transition-all hover:-translate-y-[2px]"
            >
              {isClaimingRoyalties ? "Claiming..." : "Claim Royalties"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="owned" className="w-full">
          <TabsList className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
            <TabsTrigger
              value="owned"
              className="rounded-lg text-sm data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white"
            >
              Owned ({ownedAgents.length})
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-lg text-sm data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="rounded-lg text-sm data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white"
            >
              Stats
            </TabsTrigger>
          </TabsList>

          {/* Owned Agents */}
          <TabsContent value="owned" className="mt-6">
            {ownedAgents.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedAgents.map((agent) => (
                  <AgentCard key={agent.tokenId} {...agent} />
                ))}
              </div>
            ) : (
              <div className="text-center py-24 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto">
                  <Wallet className="w-7 h-7 text-[#6b7280]" />
                </div>
                <p className="text-[#ededed] font-bold">No agents yet</p>
                <p className="text-sm text-[#6b7280]">
                  Mint your first agent to start competing.
                </p>
                <Link href="/mint">
                  <Button className="mt-2 bg-[#7c3aed] hover:bg-[#5b21b6] text-white rounded-xl font-semibold transition-all hover:-translate-y-[2px]">
                    Mint First Agent
                  </Button>
                </Link>
              </div>
            )}
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity" className="mt-6">
            <div className="glass-card rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-white/[0.02]">
                    <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Type</TableHead>
                    <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Agent</TableHead>
                    <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Details</TableHead>
                    <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-white/[0.06]">
                    <TableCell colSpan={4} className="text-center py-12 text-[#6b7280] text-sm">
                      No activity recorded yet
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Stats */}
          <TabsContent value="stats" className="mt-6">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { label: "Total Agents", value: ownedAgents.length.toString(), color: "#7c3aed" },
                {
                  label: "Total Battles",
                  value: ownedAgents.reduce((s, a) => s + a.wins + a.losses, 0).toString(),
                  color: "#dc2626",
                },
                {
                  label: "Avg Win Rate",
                  value:
                    ownedAgents.length > 0
                      ? `${((ownedAgents.reduce((s, a) => s + a.wins, 0) / ownedAgents.reduce((s, a) => s + a.wins + a.losses, 1)) * 100).toFixed(1)}%`
                      : "—",
                  color: "#10b981",
                },
              ].map((stat) => (
                <div key={stat.label} className="glass-card rounded-2xl p-6 space-y-2">
                  <p className="text-xs text-[#6b7280] font-mono uppercase tracking-wider">{stat.label}</p>
                  <p className="text-4xl font-black font-mono" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
