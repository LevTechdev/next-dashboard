"use client";

import React, { useState, useMemo } from "react";
import { INDONESIAN_BANKS, IndonesianBank, BankCategory, BankRegion } from "@/lib/indonesian-banks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BankCardVisual } from "@/components/ui/bank-card-visual";
import { Search, Building2, Landmark, Globe, Smartphone, Check } from "lucide-react";

interface BankDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectBank?: (bank: IndonesianBank) => void;
}

export function BankDirectoryDialog({
  open,
  onOpenChange,
  onSelectBank,
}: BankDirectoryDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBpdRegion, setSelectedBpdRegion] = useState<string>("all");
  const [activeBank, setActiveBank] = useState<IndonesianBank>(INDONESIAN_BANKS[0]);

  // Filtered Banks
  const filteredBanks = useMemo(() => {
    return INDONESIAN_BANKS.filter((bank) => {
      // Category filter
      if (selectedCategory !== "all") {
        if (bank.category !== selectedCategory) return false;
      }
      // BPD Region Sub-filter
      if (selectedCategory === "bpd" && selectedBpdRegion !== "all") {
        if (bank.region !== selectedBpdRegion) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          bank.name.toLowerCase().includes(q) ||
          bank.shortName.toLowerCase().includes(q) ||
          bank.code.includes(q) ||
          bank.region.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [searchQuery, selectedCategory, selectedBpdRegion]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/80">
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Direktori Kartu & Bank Nasional (4 Wilayah)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Daftar 50+ bank BUMN, swasta nasional, BPD 4 wilayah, dan bank digital dengan
                  kliring BI-FAST
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
              {filteredBanks.length} Bank Terdaftar
            </Badge>
          </div>
        </DialogHeader>

        {/* Filter Controls */}
        <div className="p-4 border-b border-border/60 space-y-3 bg-background">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama bank, singkatan (BCA, Mandiri), atau 3-digit kode kliring (014, 008)..."
              className="pl-9 h-9 text-xs border-border/70 focus-visible:ring-primary"
            />
          </div>

          {/* Main Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <Button
              type="button"
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-lg px-3"
              onClick={() => {
                setSelectedCategory("all");
                setSelectedBpdRegion("all");
              }}
            >
              Semua ({INDONESIAN_BANKS.length})
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "bumn" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-lg px-3"
              onClick={() => {
                setSelectedCategory("bumn");
                setSelectedBpdRegion("all");
              }}
            >
              <Building2 className="h-3 w-3 mr-1" />
              BUMN / Himbara (5)
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "swasta" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-lg px-3"
              onClick={() => {
                setSelectedCategory("swasta");
                setSelectedBpdRegion("all");
              }}
            >
              <Landmark className="h-3 w-3 mr-1" />
              Swasta Nasional (16)
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "bpd" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-lg px-3"
              onClick={() => setSelectedCategory("bpd")}
            >
              <Globe className="h-3 w-3 mr-1" />
              BPD 4 Wilayah (26)
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "digital" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-lg px-3"
              onClick={() => {
                setSelectedCategory("digital");
                setSelectedBpdRegion("all");
              }}
            >
              <Smartphone className="h-3 w-3 mr-1" />
              Bank Digital (8)
            </Button>
          </div>

          {/* BPD Regional Sub-tabs (when BPD category selected) */}
          {selectedCategory === "bpd" && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/50 text-[11px]">
              <span className="text-muted-foreground mr-1 font-medium">Wilayah BPD:</span>
              <button
                type="button"
                onClick={() => setSelectedBpdRegion("all")}
                className={`px-2 py-0.5 rounded ${
                  selectedBpdRegion === "all"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Semua Wilayah
              </button>
              <button
                type="button"
                onClick={() => setSelectedBpdRegion("sumatera")}
                className={`px-2 py-0.5 rounded ${
                  selectedBpdRegion === "sumatera"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Wilayah 1: Sumatera (8)
              </button>
              <button
                type="button"
                onClick={() => setSelectedBpdRegion("jawa_bali")}
                className={`px-2 py-0.5 rounded ${
                  selectedBpdRegion === "jawa_bali"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Wilayah 2: Jawa & Bali (6)
              </button>
              <button
                type="button"
                onClick={() => setSelectedBpdRegion("kalimantan_sulawesi")}
                className={`px-2 py-0.5 rounded ${
                  selectedBpdRegion === "kalimantan_sulawesi"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Wilayah 3: Kalimantan & Sulawesi (8)
              </button>
              <button
                type="button"
                onClick={() => setSelectedBpdRegion("indonesia_timur")}
                className={`px-2 py-0.5 rounded ${
                  selectedBpdRegion === "indonesia_timur"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Wilayah 4: Indonesia Timur (4)
              </button>
            </div>
          )}
        </div>

        {/* Content Body: Split View (Bank List + Live Tactile Card Preview) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Bank Scroll List */}
          <div className="md:col-span-7 overflow-y-auto p-3 space-y-1.5 max-h-[50vh] md:max-h-[55vh]">
            {filteredBanks.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Tidak ada bank yang cocok dengan pencarian &quot;{searchQuery}&quot;.
              </div>
            ) : (
              filteredBanks.map((bank) => {
                const isSelected = activeBank.code === bank.code;
                return (
                  <div
                    key={bank.code}
                    onClick={() => setActiveBank(bank)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary/50 shadow-sm"
                        : "bg-card hover:bg-muted/40 border-border/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-white shadow-sm"
                        style={{ backgroundColor: bank.brandColor }}
                      >
                        {bank.shortName.slice(0, 3)}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          {bank.name}
                          {bank.popular && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            >
                              Utama
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="font-mono">Kode: {bank.code}</span>
                          <span>•</span>
                          <span>
                            {bank.region === "national"
                              ? "Nasional"
                              : `BPD ${bank.region.replace("_", " ")}`}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            BI-FAST Aktif
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {bank.supportedNetworks.map((net) => (
                          <span
                            key={net}
                            className="text-[9px] uppercase px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                          >
                            {net}
                          </span>
                        ))}
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Live Card Simulation & Selection CTA */}
          <div className="md:col-span-5 p-5 bg-muted/20 border-t md:border-t-0 md:border-l border-border/60 flex flex-col justify-between items-center text-center">
            <div className="w-full space-y-4 flex flex-col items-center">
              <div className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                Simulasi Kartu Fisik Real-Life
              </div>

              {/* Live Bank Card Visual */}
              <BankCardVisual
                cardNumber="•••• •••• •••• 5821"
                cardHolder="BENEFICIARY ACCOUNT"
                expiry="10/29"
                brand={
                  activeBank.supportedNetworks.includes("visa")
                    ? "visa"
                    : activeBank.supportedNetworks.includes("mastercard")
                      ? "mastercard"
                      : "gpn"
                }
                tier={activeBank.popular ? "platinum" : "gold"}
                bankName={activeBank.name.toUpperCase()}
                className="w-full shadow-2xl scale-95"
              />

              {/* Bank Metadata Specs */}
              <div className="w-full bg-card rounded-xl p-3 border border-border/60 text-left text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kategori Bank:</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                    {activeBank.category.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kode Transfer Kliring:</span>
                  <span className="font-mono font-bold text-primary">{activeBank.code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Panjang Rekening:</span>
                  <span className="font-mono">
                    {activeBank.accountLengths.join(" atau ")} Digit
                  </span>
                </div>
                {activeBank.swiftCode && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Kode SWIFT / BIC:</span>
                    <span className="font-mono">{activeBank.swiftCode}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Jaringan Kliring:</span>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    BI-FAST &amp; Realtime Online
                  </span>
                </div>
              </div>
            </div>

            {/* Select Bank Action */}
            <div className="w-full pt-4">
              <Button
                type="button"
                onClick={() => {
                  onSelectBank?.(activeBank);
                  onOpenChange(false);
                }}
                className="w-full h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
              >
                Gunakan Bank Ini untuk Penarikan
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
