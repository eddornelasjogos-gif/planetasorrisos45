"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/Mascot";

interface CongratsModalProps {
  isOpen: boolean;
  playerName: string;
  score: number;
  onRestart: () => void;
  onExit: () => void;
  onClose: () => void;
}

const CongratsModal: React.FC<CongratsModalProps> = ({ isOpen, playerName, score, onRestart, onExit, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-6 bg-white/95 backdrop-blur-sm shadow-glow">
        <DialogHeader className="text-center">
          <Mascot message={`Parabéns, ${playerName}!`} className="mx-auto mb-4" />
          <DialogTitle className="text-2xl font-display font-bold text-foreground">Você alcançou uma grande pontuação!</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            Sua pontuação atual é <strong>{score}</strong>. Deseja continuar jogando ou voltar ao menu?
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button className="w-full" onClick={onRestart}>
            Jogar Novamente
          </Button>
          <Button variant="secondary" className="w-full" onClick={onExit}>
            Voltar ao Menu
          </Button>
        </div>

        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Continuar Jogando
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CongratsModal;