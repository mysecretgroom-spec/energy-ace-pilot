export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          adresse: string | null
          code_postal: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          notes: string | null
          prenom: string | null
          source: string | null
          telephone: string | null
          telephone_secondaire: string | null
          updated_at: string
          user_id: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          notes?: string | null
          prenom?: string | null
          source?: string | null
          telephone?: string | null
          telephone_secondaire?: string | null
          updated_at?: string
          user_id: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          notes?: string | null
          prenom?: string | null
          source?: string | null
          telephone?: string | null
          telephone_secondaire?: string | null
          updated_at?: string
          user_id?: string
          ville?: string | null
        }
        Relationships: []
      }
      data_commissions: {
        Row: {
          bonus_survente: number | null
          created_at: string
          id: string
          taux_commission: number
          tranche_max: number
          tranche_min: number
        }
        Insert: {
          bonus_survente?: number | null
          created_at?: string
          id?: string
          taux_commission: number
          tranche_max?: number
          tranche_min?: number
        }
        Update: {
          bonus_survente?: number | null
          created_at?: string
          id?: string
          taux_commission?: number
          tranche_max?: number
          tranche_min?: number
        }
        Relationships: []
      }
      data_orientation: {
        Row: {
          coefficient: number
          created_at: string
          id: string
          inclinaison: number
          orientation: string
        }
        Insert: {
          coefficient?: number
          created_at?: string
          id?: string
          inclinaison: number
          orientation: string
        }
        Update: {
          coefficient?: number
          created_at?: string
          id?: string
          inclinaison?: number
          orientation?: string
        }
        Relationships: []
      }
      data_prix_bouquets: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          nom_bouquet: string
          prix_max: number
          prix_recommande: number
          puissance_kwc: number
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nom_bouquet: string
          prix_max: number
          prix_recommande: number
          puissance_kwc: number
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nom_bouquet?: string
          prix_max?: number
          prix_recommande?: number
          puissance_kwc?: number
          updated_at?: string
        }
        Relationships: []
      }
      data_psh: {
        Row: {
          created_at: string
          department_code: string
          department_name: string
          id: string
          max_psh_value: number
          psh_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_code: string
          department_name: string
          id?: string
          max_psh_value?: number
          psh_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_code?: string
          department_name?: string
          id?: string
          max_psh_value?: number
          psh_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      data_surcouts: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          nom: string
          prix: number
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          prix: number
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          prix?: number
        }
        Relationships: []
      }
      data_tarifs_revente: {
        Row: {
          actif: boolean
          created_at: string
          date_effet: string
          id: string
          prix_kwh: number
          puissance_max: number
          puissance_min: number
          type_revente: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          date_effet?: string
          id?: string
          prix_kwh: number
          puissance_max?: number
          puissance_min?: number
          type_revente: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          date_effet?: string
          id?: string
          prix_kwh?: number
          puissance_max?: number
          puissance_min?: number
          type_revente?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          client_id: string
          created_at: string
          etude_id: string | null
          id: string
          mime_type: string | null
          nom: string
          taille_bytes: number | null
          type_document: Database["public"]["Enums"]["document_type"]
          url: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          etude_id?: string | null
          id?: string
          mime_type?: string | null
          nom: string
          taille_bytes?: number | null
          type_document?: Database["public"]["Enums"]["document_type"]
          url: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          etude_id?: string | null
          id?: string
          mime_type?: string | null
          nom?: string
          taille_bytes?: number | null
          type_document?: Database["public"]["Enums"]["document_type"]
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_etude_id_fkey"
            columns: ["etude_id"]
            isOneToOne: false
            referencedRelation: "etudes"
            referencedColumns: ["id"]
          },
        ]
      }
      emails_autorises: {
        Row: {
          actif: boolean | null
          created_at: string
          email: string
          id: string
          nom_source: string | null
          user_id: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          email: string
          id?: string
          nom_source?: string | null
          user_id: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          email?: string
          id?: string
          nom_source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      etudes: {
        Row: {
          autoconsommation_kwh: number | null
          autoconsommation_pct: number | null
          client_id: string
          consommation_annuelle_kwh: number | null
          created_at: string
          duree_financement_mois: number | null
          facture_annuelle_euros: number | null
          gain_autoconso_euros: number | null
          gain_total_annuel: number | null
          id: string
          inclinaison: number | null
          mensualite_estimee: number | null
          mode_hejja_prix: boolean | null
          mode_hejja_psh: boolean | null
          nombre_panneaux: number | null
          notes: string | null
          orientation: string | null
          photo_compteur: string | null
          photo_inclinaison: string | null
          photo_tableau: string | null
          photo_toiture: string | null
          prix_installation: number | null
          prix_total: number | null
          production_annuelle_kwh: number | null
          puissance_kwc: number | null
          rdv_id: string | null
          resultat_mensuel: number | null
          revente_euros: number | null
          revente_kwh: number | null
          support: string | null
          surcouts: Json | null
          type_revente: string | null
          updated_at: string
          user_id: string
          verdict: Database["public"]["Enums"]["etude_verdict"] | null
        }
        Insert: {
          autoconsommation_kwh?: number | null
          autoconsommation_pct?: number | null
          client_id: string
          consommation_annuelle_kwh?: number | null
          created_at?: string
          duree_financement_mois?: number | null
          facture_annuelle_euros?: number | null
          gain_autoconso_euros?: number | null
          gain_total_annuel?: number | null
          id?: string
          inclinaison?: number | null
          mensualite_estimee?: number | null
          mode_hejja_prix?: boolean | null
          mode_hejja_psh?: boolean | null
          nombre_panneaux?: number | null
          notes?: string | null
          orientation?: string | null
          photo_compteur?: string | null
          photo_inclinaison?: string | null
          photo_tableau?: string | null
          photo_toiture?: string | null
          prix_installation?: number | null
          prix_total?: number | null
          production_annuelle_kwh?: number | null
          puissance_kwc?: number | null
          rdv_id?: string | null
          resultat_mensuel?: number | null
          revente_euros?: number | null
          revente_kwh?: number | null
          support?: string | null
          surcouts?: Json | null
          type_revente?: string | null
          updated_at?: string
          user_id: string
          verdict?: Database["public"]["Enums"]["etude_verdict"] | null
        }
        Update: {
          autoconsommation_kwh?: number | null
          autoconsommation_pct?: number | null
          client_id?: string
          consommation_annuelle_kwh?: number | null
          created_at?: string
          duree_financement_mois?: number | null
          facture_annuelle_euros?: number | null
          gain_autoconso_euros?: number | null
          gain_total_annuel?: number | null
          id?: string
          inclinaison?: number | null
          mensualite_estimee?: number | null
          mode_hejja_prix?: boolean | null
          mode_hejja_psh?: boolean | null
          nombre_panneaux?: number | null
          notes?: string | null
          orientation?: string | null
          photo_compteur?: string | null
          photo_inclinaison?: string | null
          photo_tableau?: string | null
          photo_toiture?: string | null
          prix_installation?: number | null
          prix_total?: number | null
          production_annuelle_kwh?: number | null
          puissance_kwc?: number | null
          rdv_id?: string | null
          resultat_mensuel?: number | null
          revente_euros?: number | null
          revente_kwh?: number | null
          support?: string | null
          surcouts?: Json | null
          type_revente?: string | null
          updated_at?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["etude_verdict"] | null
        }
        Relationships: [
          {
            foreignKeyName: "etudes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etudes_rdv_id_fkey"
            columns: ["rdv_id"]
            isOneToOne: false
            referencedRelation: "rdv"
            referencedColumns: ["id"]
          },
        ]
      }
      frais: {
        Row: {
          categorie: Database["public"]["Enums"]["frais_categorie"]
          created_at: string
          date_frais: string
          description: string | null
          id: string
          justificatif_url: string | null
          montant: number
          ocr_data: Json | null
          user_id: string
        }
        Insert: {
          categorie: Database["public"]["Enums"]["frais_categorie"]
          created_at?: string
          date_frais?: string
          description?: string | null
          id?: string
          justificatif_url?: string | null
          montant: number
          ocr_data?: Json | null
          user_id: string
        }
        Update: {
          categorie?: Database["public"]["Enums"]["frais_categorie"]
          created_at?: string
          date_frais?: string
          description?: string | null
          id?: string
          justificatif_url?: string | null
          montant?: number
          ocr_data?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      historique_actions: {
        Row: {
          action_type: string
          client_id: string
          created_at: string
          description: string | null
          etude_id: string | null
          id: string
          metadata: Json | null
          rdv_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          client_id: string
          created_at?: string
          description?: string | null
          etude_id?: string | null
          id?: string
          metadata?: Json | null
          rdv_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          client_id?: string
          created_at?: string
          description?: string | null
          etude_id?: string | null
          id?: string
          metadata?: Json | null
          rdv_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historique_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_actions_etude_id_fkey"
            columns: ["etude_id"]
            isOneToOne: false
            referencedRelation: "etudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_actions_rdv_id_fkey"
            columns: ["rdv_id"]
            isOneToOne: false
            referencedRelation: "rdv"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          biometric_enabled: boolean | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          pin_code: string | null
          updated_at: string
          user_id: string
          zone_geographique: string | null
        }
        Insert: {
          avatar_url?: string | null
          biometric_enabled?: boolean | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          pin_code?: string | null
          updated_at?: string
          user_id: string
          zone_geographique?: string | null
        }
        Update: {
          avatar_url?: string | null
          biometric_enabled?: boolean | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          pin_code?: string | null
          updated_at?: string
          user_id?: string
          zone_geographique?: string | null
        }
        Relationships: []
      }
      rdv: {
        Row: {
          adresse: string | null
          client_id: string
          commentaire: string | null
          created_at: string
          date_heure: string
          duree_minutes: number | null
          email_source_id: string | null
          historique: Json | null
          id: string
          status: Database["public"]["Enums"]["rdv_status"]
          type_projet: Database["public"]["Enums"]["project_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse?: string | null
          client_id: string
          commentaire?: string | null
          created_at?: string
          date_heure: string
          duree_minutes?: number | null
          email_source_id?: string | null
          historique?: Json | null
          id?: string
          status?: Database["public"]["Enums"]["rdv_status"]
          type_projet?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse?: string | null
          client_id?: string
          commentaire?: string | null
          created_at?: string
          date_heure?: string
          duree_minutes?: number | null
          email_source_id?: string | null
          historique?: Json | null
          id?: string
          status?: Database["public"]["Enums"]["rdv_status"]
          type_projet?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdv_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      document_type:
        | "cni"
        | "justificatif_domicile"
        | "facture_energie"
        | "bon_commande"
        | "devis"
        | "autre"
      etude_verdict: "valide" | "a_etudier" | "invalide"
      frais_categorie:
        | "carburant"
        | "peage"
        | "repas"
        | "hotel"
        | "parking"
        | "autre"
      project_type:
        | "photovoltaique"
        | "pompe_chaleur"
        | "isolation"
        | "ballon_thermo"
        | "autre"
      rdv_status:
        | "nouveau"
        | "reporte"
        | "r2"
        | "r2_prestudy"
        | "signe"
        | "negatif"
        | "annule"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      document_type: [
        "cni",
        "justificatif_domicile",
        "facture_energie",
        "bon_commande",
        "devis",
        "autre",
      ],
      etude_verdict: ["valide", "a_etudier", "invalide"],
      frais_categorie: [
        "carburant",
        "peage",
        "repas",
        "hotel",
        "parking",
        "autre",
      ],
      project_type: [
        "photovoltaique",
        "pompe_chaleur",
        "isolation",
        "ballon_thermo",
        "autre",
      ],
      rdv_status: [
        "nouveau",
        "reporte",
        "r2",
        "r2_prestudy",
        "signe",
        "negatif",
        "annule",
      ],
    },
  },
} as const
