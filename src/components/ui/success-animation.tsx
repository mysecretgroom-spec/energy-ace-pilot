import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface SuccessAnimationProps {
  message?: string;
  subMessage?: string;
}

export const SuccessAnimation = ({ 
  message = "Connexion réussie", 
  subMessage = "Redirection en cours..." 
}: SuccessAnimationProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4">
        {/* Animated checkmark circle */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.1 
          }}
          className="relative"
        >
          {/* Outer ring */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="absolute inset-0 rounded-full bg-primary/20"
            style={{ width: 96, height: 96 }}
          />
          
          {/* Main circle */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              type: "spring", 
              stiffness: 260, 
              damping: 20,
              delay: 0.15 
            }}
            className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg"
          >
            {/* Checkmark with draw animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                delay: 0.4,
                type: "spring",
                stiffness: 300,
                damping: 15
              }}
            >
              <Check className="h-12 w-12 text-primary-foreground" strokeWidth={3} />
            </motion.div>
          </motion.div>

          {/* Pulse effect */}
          <motion.div
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ 
              delay: 0.5,
              duration: 0.6,
              ease: "easeOut"
            }}
            className="absolute inset-0 rounded-full bg-primary"
            style={{ width: 96, height: 96 }}
          />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.3 }}
          className="text-center"
        >
          <h2 className="text-xl font-semibold text-foreground">{message}</h2>
          <p className="text-sm text-muted-foreground mt-1">{subMessage}</p>
        </motion.div>

        {/* Loading dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex gap-1"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                y: [0, -6, 0],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{ 
                duration: 0.6,
                delay: i * 0.15,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};
