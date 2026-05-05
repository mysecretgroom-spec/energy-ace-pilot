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
      agent_conversation_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          reply_to_message_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          reply_to_message_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          reply_to_message_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversation_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "agent_conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_preview: string | null
          message_count: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_preview?: string | null
          message_count?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_preview?: string | null
          message_count?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          estimated_cost_usd: number
          function_name: string
          id: string
          image_count: number
          input_tokens: number
          model: string
          month_key: string
          output_tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost_usd?: number
          function_name: string
          id?: string
          image_count?: number
          input_tokens?: number
          model: string
          month_key: string
          output_tokens?: number
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost_usd?: number
          function_name?: string
          id?: string
          image_count?: number
          input_tokens?: number
          model?: string
          month_key?: string
          output_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_workflow_edges: {
        Row: {
          condition_config: Json | null
          condition_type: string | null
          created_at: string
          id: string
          source_node_id: string
          target_node_id: string
          workflow_id: string
        }
        Insert: {
          condition_config?: Json | null
          condition_type?: string | null
          created_at?: string
          id?: string
          source_node_id: string
          target_node_id: string
          workflow_id: string
        }
        Update: {
          condition_config?: Json | null
          condition_type?: string | null
          created_at?: string
          id?: string
          source_node_id?: string
          target_node_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "ai_workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_workflow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "ai_workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_workflow_edges_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "ai_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_workflow_nodes: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          label: string
          position_x: number
          position_y: number
          type: string
          workflow_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          label: string
          position_x?: number
          position_y?: number
          type: string
          workflow_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          label?: string
          position_x?: number
          position_y?: number
          type?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflow_nodes_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "ai_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_workflows: {
        Row: {
          actif: boolean
          canaux: string[] | null
          categorie: string
          code: string
          config: Json | null
          created_at: string
          description: string | null
          id: string
          nom: string
          ordre: number | null
          prompt_personnalise: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          canaux?: string[] | null
          categorie: string
          code: string
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          ordre?: number | null
          prompt_personnalise?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          canaux?: string[] | null
          categorie?: string
          code?: string
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          ordre?: number | null
          prompt_personnalise?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      background_jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          max_attempts: number | null
          payload: Json
          priority: number | null
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          max_attempts?: number | null
          payload?: Json
          priority?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          max_attempts?: number | null
          payload?: Json
          priority?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bouquets: {
        Row: {
          actif: boolean
          commission_fixe: number | null
          commission_pct: number | null
          created_at: string
          description: string | null
          id: string
          nom_bouquet: string
          prix_hejja: number | null
          prix_max: number
          prix_recommande: number
          product_type: Database["public"]["Enums"]["product_type"] | null
          puissance_kwc: number
          regie_ids: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          commission_fixe?: number | null
          commission_pct?: number | null
          created_at?: string
          description?: string | null
          id?: string
          nom_bouquet: string
          prix_hejja?: number | null
          prix_max: number
          prix_recommande: number
          product_type?: Database["public"]["Enums"]["product_type"] | null
          puissance_kwc: number
          regie_ids?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          commission_fixe?: number | null
          commission_pct?: number | null
          created_at?: string
          description?: string | null
          id?: string
          nom_bouquet?: string
          prix_hejja?: number | null
          prix_max?: number
          prix_recommande?: number
          product_type?: Database["public"]["Enums"]["product_type"] | null
          puissance_kwc?: number
          regie_ids?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          adresse: string | null
          code_postal: string | null
          created_at: string
          email: string | null
          id: string
          is_retape: boolean | null
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          nom: string
          notes: string | null
          prenom: string | null
          regie_id: string | null
          retape_original_id: string | null
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
          is_retape?: boolean | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          nom: string
          notes?: string | null
          prenom?: string | null
          regie_id?: string | null
          retape_original_id?: string | null
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
          is_retape?: boolean | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          nom?: string
          notes?: string | null
          prenom?: string | null
          regie_id?: string | null
          retape_original_id?: string | null
          source?: string | null
          telephone?: string | null
          telephone_secondaire?: string | null
          updated_at?: string
          user_id?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_retape_original_id_fkey"
            columns: ["retape_original_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          bonus_survente: number | null
          created_at: string
          date_calcul: string
          date_paiement: string | null
          id: string
          montant_base: number
          montant_commission: number
          paye: boolean | null
          taux_commission: number
          user_id: string
          vente_id: string
        }
        Insert: {
          bonus_survente?: number | null
          created_at?: string
          date_calcul?: string
          date_paiement?: string | null
          id?: string
          montant_base: number
          montant_commission: number
          paye?: boolean | null
          taux_commission: number
          user_id: string
          vente_id: string
        }
        Update: {
          bonus_survente?: number | null
          created_at?: string
          date_calcul?: string
          date_paiement?: string | null
          id?: string
          montant_base?: number
          montant_commission?: number
          paye?: boolean | null
          taux_commission?: number
          user_id?: string
          vente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      config_commissions: {
        Row: {
          created_at: string
          id: string
          mode_calcul: string
          part_survente_pct: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode_calcul?: string
          part_survente_pct?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mode_calcul?: string
          part_survente_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      confirmateurs: {
        Row: {
          actif: boolean | null
          created_at: string
          id: string
          nom: string
          ordre_priorite: number | null
          regie_id: string | null
          role: Database["public"]["Enums"]["confirmateur_role"]
          telephone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom: string
          ordre_priorite?: number | null
          regie_id?: string | null
          role?: Database["public"]["Enums"]["confirmateur_role"]
          telephone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom?: string
          ordre_priorite?: number | null
          regie_id?: string | null
          role?: Database["public"]["Enums"]["confirmateur_role"]
          telephone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmateurs_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
        ]
      }
      data_aides: {
        Row: {
          actif: boolean
          code: string
          conditions: string | null
          created_at: string
          description: string | null
          id: string
          nom: string
          puissance_max: number | null
          puissance_min: number | null
          type_calcul: string
          updated_at: string
          user_id: string | null
          valeur: number
        }
        Insert: {
          actif?: boolean
          code: string
          conditions?: string | null
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          puissance_max?: number | null
          puissance_min?: number | null
          type_calcul?: string
          updated_at?: string
          user_id?: string | null
          valeur?: number
        }
        Update: {
          actif?: boolean
          code?: string
          conditions?: string | null
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          puissance_max?: number | null
          puissance_min?: number | null
          type_calcul?: string
          updated_at?: string
          user_id?: string | null
          valeur?: number
        }
        Relationships: []
      }
      data_aides_ite: {
        Row: {
          actif: boolean
          code: string
          conditions: string | null
          created_at: string
          id: string
          montant_m2: number | null
          montant_plafond: number | null
          nom: string
          profil_revenus: string | null
          surface_min: number | null
          type_aide: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          code: string
          conditions?: string | null
          created_at?: string
          id?: string
          montant_m2?: number | null
          montant_plafond?: number | null
          nom: string
          profil_revenus?: string | null
          surface_min?: number | null
          type_aide: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          code?: string
          conditions?: string | null
          created_at?: string
          id?: string
          montant_m2?: number | null
          montant_plafond?: number | null
          nom?: string
          profil_revenus?: string | null
          surface_min?: number | null
          type_aide?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_aides_pac: {
        Row: {
          actif: boolean
          code: string
          conditions: string | null
          created_at: string
          id: string
          montant_fixe: number | null
          montant_plafond: number | null
          nom: string
          pac_subtype: string | null
          profil_revenus: string | null
          type_aide: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          code: string
          conditions?: string | null
          created_at?: string
          id?: string
          montant_fixe?: number | null
          montant_plafond?: number | null
          nom: string
          pac_subtype?: string | null
          profil_revenus?: string | null
          type_aide: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          code?: string
          conditions?: string | null
          created_at?: string
          id?: string
          montant_fixe?: number | null
          montant_plafond?: number | null
          nom?: string
          pac_subtype?: string | null
          profil_revenus?: string | null
          type_aide?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_calibres: {
        Row: {
          actif: boolean
          calibre_amperes: number
          created_at: string
          id: string
          intensite_max_a: number
          puissance_kva: number
          usage_typique: string | null
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          calibre_amperes: number
          created_at?: string
          id?: string
          intensite_max_a: number
          puissance_kva: number
          usage_typique?: string | null
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          calibre_amperes?: number
          created_at?: string
          id?: string
          intensite_max_a?: number
          puissance_kva?: number
          usage_typique?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      data_commissions: {
        Row: {
          bonus_survente: number | null
          created_at: string
          id: string
          product_type: Database["public"]["Enums"]["product_type"] | null
          taux_commission: number
          tranche_max: number
          tranche_min: number
          user_id: string | null
        }
        Insert: {
          bonus_survente?: number | null
          created_at?: string
          id?: string
          product_type?: Database["public"]["Enums"]["product_type"] | null
          taux_commission: number
          tranche_max?: number
          tranche_min?: number
          user_id?: string | null
        }
        Update: {
          bonus_survente?: number | null
          created_at?: string
          id?: string
          product_type?: Database["public"]["Enums"]["product_type"] | null
          taux_commission?: number
          tranche_max?: number
          tranche_min?: number
          user_id?: string | null
        }
        Relationships: []
      }
      data_compteurs: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          montant: number
          type_compteur: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          montant?: number
          type_compteur: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          montant?: number
          type_compteur?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_energies_prix: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          pouvoir_calorifique_kwh: number | null
          prix_kwh: number
          type_energie: string
          unite: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          pouvoir_calorifique_kwh?: number | null
          prix_kwh?: number
          type_energie: string
          unite?: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          pouvoir_calorifique_kwh?: number | null
          prix_kwh?: number
          type_energie?: string
          unite?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_estimateur_coefficients: {
        Row: {
          actif: boolean
          categorie: string
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          unite: string
          user_id: string | null
          valeur: number
        }
        Insert: {
          actif?: boolean
          categorie: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          unite?: string
          user_id?: string | null
          valeur?: number
        }
        Update: {
          actif?: boolean
          categorie?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          unite?: string
          user_id?: string | null
          valeur?: number
        }
        Relationships: []
      }
      data_evolution_prix_energie: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          taux_augmentation_annuel: number
          type_energie: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          taux_augmentation_annuel?: number
          type_energie: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          taux_augmentation_annuel?: number
          type_energie?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_financements: {
        Row: {
          actif: boolean
          created_at: string
          duree_mois: number
          id: string
          nom: string
          taeg: number
          taux_effectif: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          duree_mois?: number
          id?: string
          nom: string
          taeg?: number
          taux_effectif?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          duree_mois?: number
          id?: string
          nom?: string
          taeg?: number
          taux_effectif?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_ite_economies: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          economie_chauffage_pct: number
          gain_r_max: number
          gain_r_min: number
          id: string
          user_id: string | null
          zone_climatique: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          economie_chauffage_pct: number
          gain_r_max: number
          gain_r_min: number
          id?: string
          user_id?: string | null
          zone_climatique?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          economie_chauffage_pct?: number
          gain_r_max?: number
          gain_r_min?: number
          id?: string
          user_id?: string | null
          zone_climatique?: string | null
        }
        Relationships: []
      }
      data_ite_finitions: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          prix_m2: number
          type_finition: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          prix_m2?: number
          type_finition: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          prix_m2?: number
          type_finition?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_ite_isolants: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          lambda: number
          prix_m2: number
          type_isolant: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          lambda: number
          prix_m2?: number
          type_isolant: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          lambda?: number
          prix_m2?: number
          type_isolant?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_ite_murs: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          epaisseur_cm: number | null
          id: string
          r_initial: number
          type_mur: string
          u_initial: number
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          epaisseur_cm?: number | null
          id?: string
          r_initial: number
          type_mur: string
          u_initial: number
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          epaisseur_cm?: number | null
          id?: string
          r_initial?: number
          type_mur?: string
          u_initial?: number
          user_id?: string | null
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
          user_id: string | null
        }
        Insert: {
          coefficient?: number
          created_at?: string
          id?: string
          inclinaison: number
          orientation: string
          user_id?: string | null
        }
        Update: {
          coefficient?: number
          created_at?: string
          id?: string
          inclinaison?: number
          orientation?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_pac_cop: {
        Row: {
          actif: boolean
          cop_moyen: number
          created_at: string
          id: string
          pac_subtype: Database["public"]["Enums"]["pac_subtype"]
          temperature_exterieure: number
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          cop_moyen?: number
          created_at?: string
          id?: string
          pac_subtype: Database["public"]["Enums"]["pac_subtype"]
          temperature_exterieure: number
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          cop_moyen?: number
          created_at?: string
          id?: string
          pac_subtype?: Database["public"]["Enums"]["pac_subtype"]
          temperature_exterieure?: number
          user_id?: string | null
        }
        Relationships: []
      }
      data_pac_isolation: {
        Row: {
          actif: boolean | null
          besoins_kwh_m2_an: number
          coefficient_deperdition: number
          created_at: string
          description: string | null
          id: string
          label: string
          niveau_isolation: string
          ordre: number | null
          user_id: string | null
        }
        Insert: {
          actif?: boolean | null
          besoins_kwh_m2_an: number
          coefficient_deperdition: number
          created_at?: string
          description?: string | null
          id?: string
          label: string
          niveau_isolation: string
          ordre?: number | null
          user_id?: string | null
        }
        Update: {
          actif?: boolean | null
          besoins_kwh_m2_an?: number
          coefficient_deperdition?: number
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          niveau_isolation?: string
          ordre?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      data_pac_puissances: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          pac_subtype: Database["public"]["Enums"]["pac_subtype"]
          puissance_recommandee: number
          surface_max: number
          surface_min: number
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id?: string
          pac_subtype: Database["public"]["Enums"]["pac_subtype"]
          puissance_recommandee: number
          surface_max: number
          surface_min: number
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          pac_subtype?: Database["public"]["Enums"]["pac_subtype"]
          puissance_recommandee?: number
          surface_max?: number
          surface_min?: number
          user_id?: string | null
        }
        Relationships: []
      }
      data_psh: {
        Row: {
          created_at: string
          department_code: string
          department_name: string
          heures_ensoleillement_annuel: number | null
          id: string
          jours_ensoleillement_pauvre: number | null
          jours_ensoleillement_riche: number | null
          max_psh_value: number
          psh_value: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department_code: string
          department_name: string
          heures_ensoleillement_annuel?: number | null
          id?: string
          jours_ensoleillement_pauvre?: number | null
          jours_ensoleillement_riche?: number | null
          max_psh_value?: number
          psh_value?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department_code?: string
          department_name?: string
          heures_ensoleillement_annuel?: number | null
          id?: string
          jours_ensoleillement_pauvre?: number | null
          jours_ensoleillement_riche?: number | null
          max_psh_value?: number
          psh_value?: number
          updated_at?: string
          user_id?: string | null
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
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          prix: number
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          prix?: number
          user_id?: string | null
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: []
      }
      data_zones_climatiques: {
        Row: {
          actif: boolean
          altitude_moyenne: number | null
          created_at: string
          department_code: string
          department_name: string
          description: string | null
          dju_base18: number
          id: string
          user_id: string | null
          zone_climatique: string
        }
        Insert: {
          actif?: boolean
          altitude_moyenne?: number | null
          created_at?: string
          department_code: string
          department_name: string
          description?: string | null
          dju_base18: number
          id?: string
          user_id?: string | null
          zone_climatique: string
        }
        Update: {
          actif?: boolean
          altitude_moyenne?: number | null
          created_at?: string
          department_code?: string
          department_name?: string
          description?: string | null
          dju_base18?: number
          id?: string
          user_id?: string | null
          zone_climatique?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_classification_confidence: number | null
          ai_extracted_fields: Json | null
          client_id: string
          context_source: string | null
          created_at: string
          etude_id: string | null
          extracted_text: string | null
          id: string
          metadata: Json | null
          mime_type: string | null
          nom: string
          page_count: number | null
          search_vector: unknown
          taille_bytes: number | null
          thumbnails_urls: string[] | null
          type_document: Database["public"]["Enums"]["document_type"]
          url: string
          user_id: string
        }
        Insert: {
          ai_classification_confidence?: number | null
          ai_extracted_fields?: Json | null
          client_id: string
          context_source?: string | null
          created_at?: string
          etude_id?: string | null
          extracted_text?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          nom: string
          page_count?: number | null
          search_vector?: unknown
          taille_bytes?: number | null
          thumbnails_urls?: string[] | null
          type_document?: Database["public"]["Enums"]["document_type"]
          url: string
          user_id: string
        }
        Update: {
          ai_classification_confidence?: number | null
          ai_extracted_fields?: Json | null
          client_id?: string
          context_source?: string | null
          created_at?: string
          etude_id?: string | null
          extracted_text?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          nom?: string
          page_count?: number | null
          search_vector?: unknown
          taille_bytes?: number | null
          thumbnails_urls?: string[] | null
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
          regie_id: string | null
          user_id: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          email: string
          id?: string
          nom_source?: string | null
          regie_id?: string | null
          user_id: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          email?: string
          id?: string
          nom_source?: string | null
          regie_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_autorises_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
        ]
      }
      etudes: {
        Row: {
          active_products: string[] | null
          aides_manuelles: Json | null
          amperage_disjoncteur: number | null
          autoconsommation_kwh: number | null
          autoconsommation_pct: number | null
          autre_surcout: number | null
          classification: string | null
          classification_comment: string | null
          classification_updated_at: string | null
          classification_updated_by: string | null
          client_id: string
          consommation_annuelle_kwh: number | null
          cq_date_heure: string | null
          created_at: string
          duree_financement_mois: number | null
          eco_tva: number | null
          economie_autoconso_mensuelle: number | null
          emplacement_boitier: string | null
          etat_toiture: string | null
          facture_annuelle_euros: number | null
          gain_autoconso_euros: number | null
          gain_total_annuel: number | null
          id: string
          inclinaison: number | null
          ite_economie_chauffage_pct: number | null
          ite_epaisseur_isolant: number | null
          ite_finition: string | null
          ite_nombre_facades: number | null
          ite_r_actuel: number | null
          ite_r_cible: number | null
          ite_surface_isoler: number | null
          ite_surface_ouvertures: number | null
          ite_type_facade: string | null
          ite_type_isolant: string | null
          mensualite_estimee: number | null
          mode_financement: string | null
          mode_hejja_prix: boolean | null
          mode_hejja_psh: boolean | null
          nombre_panneaux: number | null
          notes: string | null
          numero_cadastre: string | null
          numero_pdl: string | null
          ombre_toiture: string | null
          orientation: string | null
          pac_besoins_chauffage_kwh: number | null
          pac_conso_chauffage_kwh: number | null
          pac_conso_elec_pac_kwh: number | null
          pac_cop: number | null
          pac_economie_estimee: number | null
          pac_economie_nette_euros: number | null
          pac_ecs_integre: boolean | null
          pac_energie_actuelle: string | null
          pac_facture_chauffage_euros: number | null
          pac_facture_elec_euros: number | null
          pac_niveau_isolation: string | null
          pac_nombre_unites_int: number | null
          pac_prix_kwh_elec: number | null
          pac_profil_mpr: string | null
          pac_puissance_calorifique: number | null
          pac_subtype: Database["public"]["Enums"]["pac_subtype"] | null
          pac_surcout_elec_euros: number | null
          pac_surface_chauffee: number | null
          pac_type_emetteurs: string | null
          pac_volume_ballon: number | null
          param_overrides: Json | null
          pdf_generated_at: string | null
          pdf_url: string | null
          photo_compteur: string | null
          photo_inclinaison: string | null
          photo_tableau: string | null
          photo_toiture: string | null
          potentiel_faisabilite: string | null
          prime_autoconsommation: number | null
          prix_installation: number | null
          prix_total: number | null
          product_type: Database["public"]["Enums"]["product_type"] | null
          production_annuelle_kwh: number | null
          puissance_kwc: number | null
          r2_date_heure: string | null
          rdv_id: string | null
          rendement_productivite: number | null
          resultat_mensuel: number | null
          resultat_transfert_charge: number | null
          revente_euros: number | null
          revente_kwh: number | null
          revente_mensuelle_estimee: number | null
          support: string | null
          surcout_compteur: number | null
          surcout_support: number | null
          surcouts: Json | null
          surface_installation_m2: number | null
          surface_toiture: string | null
          surplus_production_kwh: number | null
          taux_financement: number | null
          total_aides: number | null
          total_aides_deduites: number | null
          type_compteur_electrique: string | null
          type_raccordement: string | null
          type_revente: string | null
          type_toiture: string | null
          updated_at: string
          user_id: string
          verdict: Database["public"]["Enums"]["etude_verdict"] | null
        }
        Insert: {
          active_products?: string[] | null
          aides_manuelles?: Json | null
          amperage_disjoncteur?: number | null
          autoconsommation_kwh?: number | null
          autoconsommation_pct?: number | null
          autre_surcout?: number | null
          classification?: string | null
          classification_comment?: string | null
          classification_updated_at?: string | null
          classification_updated_by?: string | null
          client_id: string
          consommation_annuelle_kwh?: number | null
          cq_date_heure?: string | null
          created_at?: string
          duree_financement_mois?: number | null
          eco_tva?: number | null
          economie_autoconso_mensuelle?: number | null
          emplacement_boitier?: string | null
          etat_toiture?: string | null
          facture_annuelle_euros?: number | null
          gain_autoconso_euros?: number | null
          gain_total_annuel?: number | null
          id?: string
          inclinaison?: number | null
          ite_economie_chauffage_pct?: number | null
          ite_epaisseur_isolant?: number | null
          ite_finition?: string | null
          ite_nombre_facades?: number | null
          ite_r_actuel?: number | null
          ite_r_cible?: number | null
          ite_surface_isoler?: number | null
          ite_surface_ouvertures?: number | null
          ite_type_facade?: string | null
          ite_type_isolant?: string | null
          mensualite_estimee?: number | null
          mode_financement?: string | null
          mode_hejja_prix?: boolean | null
          mode_hejja_psh?: boolean | null
          nombre_panneaux?: number | null
          notes?: string | null
          numero_cadastre?: string | null
          numero_pdl?: string | null
          ombre_toiture?: string | null
          orientation?: string | null
          pac_besoins_chauffage_kwh?: number | null
          pac_conso_chauffage_kwh?: number | null
          pac_conso_elec_pac_kwh?: number | null
          pac_cop?: number | null
          pac_economie_estimee?: number | null
          pac_economie_nette_euros?: number | null
          pac_ecs_integre?: boolean | null
          pac_energie_actuelle?: string | null
          pac_facture_chauffage_euros?: number | null
          pac_facture_elec_euros?: number | null
          pac_niveau_isolation?: string | null
          pac_nombre_unites_int?: number | null
          pac_prix_kwh_elec?: number | null
          pac_profil_mpr?: string | null
          pac_puissance_calorifique?: number | null
          pac_subtype?: Database["public"]["Enums"]["pac_subtype"] | null
          pac_surcout_elec_euros?: number | null
          pac_surface_chauffee?: number | null
          pac_type_emetteurs?: string | null
          pac_volume_ballon?: number | null
          param_overrides?: Json | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          photo_compteur?: string | null
          photo_inclinaison?: string | null
          photo_tableau?: string | null
          photo_toiture?: string | null
          potentiel_faisabilite?: string | null
          prime_autoconsommation?: number | null
          prix_installation?: number | null
          prix_total?: number | null
          product_type?: Database["public"]["Enums"]["product_type"] | null
          production_annuelle_kwh?: number | null
          puissance_kwc?: number | null
          r2_date_heure?: string | null
          rdv_id?: string | null
          rendement_productivite?: number | null
          resultat_mensuel?: number | null
          resultat_transfert_charge?: number | null
          revente_euros?: number | null
          revente_kwh?: number | null
          revente_mensuelle_estimee?: number | null
          support?: string | null
          surcout_compteur?: number | null
          surcout_support?: number | null
          surcouts?: Json | null
          surface_installation_m2?: number | null
          surface_toiture?: string | null
          surplus_production_kwh?: number | null
          taux_financement?: number | null
          total_aides?: number | null
          total_aides_deduites?: number | null
          type_compteur_electrique?: string | null
          type_raccordement?: string | null
          type_revente?: string | null
          type_toiture?: string | null
          updated_at?: string
          user_id: string
          verdict?: Database["public"]["Enums"]["etude_verdict"] | null
        }
        Update: {
          active_products?: string[] | null
          aides_manuelles?: Json | null
          amperage_disjoncteur?: number | null
          autoconsommation_kwh?: number | null
          autoconsommation_pct?: number | null
          autre_surcout?: number | null
          classification?: string | null
          classification_comment?: string | null
          classification_updated_at?: string | null
          classification_updated_by?: string | null
          client_id?: string
          consommation_annuelle_kwh?: number | null
          cq_date_heure?: string | null
          created_at?: string
          duree_financement_mois?: number | null
          eco_tva?: number | null
          economie_autoconso_mensuelle?: number | null
          emplacement_boitier?: string | null
          etat_toiture?: string | null
          facture_annuelle_euros?: number | null
          gain_autoconso_euros?: number | null
          gain_total_annuel?: number | null
          id?: string
          inclinaison?: number | null
          ite_economie_chauffage_pct?: number | null
          ite_epaisseur_isolant?: number | null
          ite_finition?: string | null
          ite_nombre_facades?: number | null
          ite_r_actuel?: number | null
          ite_r_cible?: number | null
          ite_surface_isoler?: number | null
          ite_surface_ouvertures?: number | null
          ite_type_facade?: string | null
          ite_type_isolant?: string | null
          mensualite_estimee?: number | null
          mode_financement?: string | null
          mode_hejja_prix?: boolean | null
          mode_hejja_psh?: boolean | null
          nombre_panneaux?: number | null
          notes?: string | null
          numero_cadastre?: string | null
          numero_pdl?: string | null
          ombre_toiture?: string | null
          orientation?: string | null
          pac_besoins_chauffage_kwh?: number | null
          pac_conso_chauffage_kwh?: number | null
          pac_conso_elec_pac_kwh?: number | null
          pac_cop?: number | null
          pac_economie_estimee?: number | null
          pac_economie_nette_euros?: number | null
          pac_ecs_integre?: boolean | null
          pac_energie_actuelle?: string | null
          pac_facture_chauffage_euros?: number | null
          pac_facture_elec_euros?: number | null
          pac_niveau_isolation?: string | null
          pac_nombre_unites_int?: number | null
          pac_prix_kwh_elec?: number | null
          pac_profil_mpr?: string | null
          pac_puissance_calorifique?: number | null
          pac_subtype?: Database["public"]["Enums"]["pac_subtype"] | null
          pac_surcout_elec_euros?: number | null
          pac_surface_chauffee?: number | null
          pac_type_emetteurs?: string | null
          pac_volume_ballon?: number | null
          param_overrides?: Json | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          photo_compteur?: string | null
          photo_inclinaison?: string | null
          photo_tableau?: string | null
          photo_toiture?: string | null
          potentiel_faisabilite?: string | null
          prime_autoconsommation?: number | null
          prix_installation?: number | null
          prix_total?: number | null
          product_type?: Database["public"]["Enums"]["product_type"] | null
          production_annuelle_kwh?: number | null
          puissance_kwc?: number | null
          r2_date_heure?: string | null
          rdv_id?: string | null
          rendement_productivite?: number | null
          resultat_mensuel?: number | null
          resultat_transfert_charge?: number | null
          revente_euros?: number | null
          revente_kwh?: number | null
          revente_mensuelle_estimee?: number | null
          support?: string | null
          surcout_compteur?: number | null
          surcout_support?: number | null
          surcouts?: Json | null
          surface_installation_m2?: number | null
          surface_toiture?: string | null
          surplus_production_kwh?: number | null
          taux_financement?: number | null
          total_aides?: number | null
          total_aides_deduites?: number | null
          type_compteur_electrique?: string | null
          type_raccordement?: string | null
          type_revente?: string | null
          type_toiture?: string | null
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
      etudes_classification_history: {
        Row: {
          classification: string
          comment: string | null
          created_at: string
          etude_id: string
          id: string
          r2_date_heure: string | null
          user_id: string
        }
        Insert: {
          classification: string
          comment?: string | null
          created_at?: string
          etude_id: string
          id?: string
          r2_date_heure?: string | null
          user_id: string
        }
        Update: {
          classification?: string
          comment?: string | null
          created_at?: string
          etude_id?: string
          id?: string
          r2_date_heure?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etudes_classification_history_etude_id_fkey"
            columns: ["etude_id"]
            isOneToOne: false
            referencedRelation: "etudes"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          created_at: string
          date_emission: string
          date_paiement: string | null
          id: string
          montant_total_ht: number
          notes: string | null
          numero_facture: string
          statut: string
          updated_at: string
          user_id: string
          vente_ids: string[]
        }
        Insert: {
          created_at?: string
          date_emission?: string
          date_paiement?: string | null
          id?: string
          montant_total_ht?: number
          notes?: string | null
          numero_facture: string
          statut?: string
          updated_at?: string
          user_id: string
          vente_ids?: string[]
        }
        Update: {
          created_at?: string
          date_emission?: string
          date_paiement?: string | null
          id?: string
          montant_total_ht?: number
          notes?: string | null
          numero_facture?: string
          statut?: string
          updated_at?: string
          user_id?: string
          vente_ids?: string[]
        }
        Relationships: []
      }
      frais: {
        Row: {
          categorie: Database["public"]["Enums"]["frais_categorie"]
          created_at: string
          date_debut: string | null
          date_fin: string | null
          date_frais: string
          description: string | null
          document_id: string | null
          fournisseur: string | null
          id: string
          justificatif_url: string | null
          montant: number
          ocr_data: Json | null
          user_id: string
        }
        Insert: {
          categorie: Database["public"]["Enums"]["frais_categorie"]
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          date_frais?: string
          description?: string | null
          document_id?: string | null
          fournisseur?: string | null
          id?: string
          justificatif_url?: string | null
          montant: number
          ocr_data?: Json | null
          user_id: string
        }
        Update: {
          categorie?: Database["public"]["Enums"]["frais_categorie"]
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          date_frais?: string
          description?: string | null
          document_id?: string | null
          fournisseur?: string | null
          id?: string
          justificatif_url?: string | null
          montant?: number
          ocr_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "frais_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_imports: {
        Row: {
          client_id: string | null
          created_at: string
          error_message: string | null
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          rdv_id: string | null
          sender_email: string | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          rdv_id?: string | null
          sender_email?: string | null
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          rdv_id?: string | null
          sender_email?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_imports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_imports_rdv_id_fkey"
            columns: ["rdv_id"]
            isOneToOne: false
            referencedRelation: "rdv"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sync_history: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          events_exported: number | null
          events_imported: number | null
          events_skipped: number | null
          events_updated: number | null
          id: string
          started_at: string
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          events_exported?: number | null
          events_imported?: number | null
          events_skipped?: number | null
          events_updated?: number | null
          id?: string
          started_at?: string
          status?: string
          sync_type?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          events_exported?: number | null
          events_imported?: number | null
          events_skipped?: number | null
          events_updated?: number | null
          id?: string
          started_at?: string
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          scopes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string
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
      mfa_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          client_id: string | null
          created_at: string
          date_envoi: string
          date_lecture: string | null
          id: string
          lue: boolean | null
          message: string
          rdv_id: string | null
          titre: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          vente_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          date_envoi?: string
          date_lecture?: string | null
          id?: string
          lue?: boolean | null
          message: string
          rdv_id?: string | null
          titre: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          vente_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          date_envoi?: string
          date_lecture?: string | null
          id?: string
          lue?: boolean | null
          message?: string
          rdv_id?: string | null
          titre?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
          vente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_rdv_id_fkey"
            columns: ["rdv_id"]
            isOneToOne: false
            referencedRelation: "rdv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      objectifs: {
        Row: {
          annee: number
          created_at: string
          id: string
          mois: number
          objectif_ca: number | null
          objectif_frais: number | null
          objectif_rdv: number | null
          objectif_ventes: number | null
          realise_ca: number | null
          realise_rdv: number | null
          realise_ventes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annee: number
          created_at?: string
          id?: string
          mois: number
          objectif_ca?: number | null
          objectif_frais?: number | null
          objectif_rdv?: number | null
          objectif_ventes?: number | null
          realise_ca?: number | null
          realise_rdv?: number | null
          realise_ventes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annee?: number
          created_at?: string
          id?: string
          mois?: number
          objectif_ca?: number | null
          objectif_frais?: number | null
          objectif_rdv?: number | null
          objectif_ventes?: number | null
          realise_ca?: number | null
          realise_rdv?: number | null
          realise_ventes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_documents: {
        Row: {
          admin_notified_at: string | null
          ai_analysis_summary: string | null
          ai_confidence: number | null
          ai_detected_client_id: string | null
          ai_detected_client_name: string | null
          ai_detected_document_type: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_client_id: string | null
          assigned_document_type: string | null
          auto_assign_after: string | null
          confirmed_type: string | null
          created_at: string
          file_size_bytes: number | null
          final_bucket: string | null
          final_document_id: string | null
          id: string
          mime_type: string | null
          original_filename: string
          processed_at: string | null
          source: string
          staging_storage_path: string | null
          status: string
          storage_path: string
          user_id: string
          workflow_type: string | null
        }
        Insert: {
          admin_notified_at?: string | null
          ai_analysis_summary?: string | null
          ai_confidence?: number | null
          ai_detected_client_id?: string | null
          ai_detected_client_name?: string | null
          ai_detected_document_type?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_client_id?: string | null
          assigned_document_type?: string | null
          auto_assign_after?: string | null
          confirmed_type?: string | null
          created_at?: string
          file_size_bytes?: number | null
          final_bucket?: string | null
          final_document_id?: string | null
          id?: string
          mime_type?: string | null
          original_filename: string
          processed_at?: string | null
          source?: string
          staging_storage_path?: string | null
          status?: string
          storage_path: string
          user_id: string
          workflow_type?: string | null
        }
        Update: {
          admin_notified_at?: string | null
          ai_analysis_summary?: string | null
          ai_confidence?: number | null
          ai_detected_client_id?: string | null
          ai_detected_client_name?: string | null
          ai_detected_document_type?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_client_id?: string | null
          assigned_document_type?: string | null
          auto_assign_after?: string | null
          confirmed_type?: string | null
          created_at?: string
          file_size_bytes?: number | null
          final_bucket?: string | null
          final_document_id?: string | null
          id?: string
          mime_type?: string | null
          original_filename?: string
          processed_at?: string | null
          source?: string
          staging_storage_path?: string | null
          status?: string
          storage_path?: string
          user_id?: string
          workflow_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_documents_ai_detected_client_id_fkey"
            columns: ["ai_detected_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_documents_assigned_client_id_fkey"
            columns: ["assigned_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_documents_final_document_id_fkey"
            columns: ["final_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      plaid_items: {
        Row: {
          access_token: string
          created_at: string
          id: string
          institution_name: string | null
          item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          institution_name?: string | null
          item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          institution_name?: string | null
          item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plaid_syncs: {
        Row: {
          created_at: string
          id: string
          plaid_item_id: string | null
          sync_type: string | null
          synced_at: string
          transactions_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plaid_item_id?: string | null
          sync_type?: string | null
          synced_at?: string
          transactions_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plaid_item_id?: string | null
          sync_type?: string | null
          synced_at?: string
          transactions_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plaid_syncs_plaid_item_id_fkey"
            columns: ["plaid_item_id"]
            isOneToOne: false
            referencedRelation: "plaid_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_analyze_docs: boolean | null
          avatar_url: string | null
          biometric_enabled: boolean | null
          biometric_login_enabled: boolean | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          nom_scene: string | null
          numero_agrement: string | null
          onboarding_completed: boolean
          phone: string | null
          pin_code: string | null
          prenom_scene: string | null
          produit_principal: string | null
          telephone_pro: string | null
          updated_at: string
          user_id: string
          webauthn_credential_id: string | null
          zone_geographique: string | null
        }
        Insert: {
          auto_analyze_docs?: boolean | null
          avatar_url?: string | null
          biometric_enabled?: boolean | null
          biometric_login_enabled?: boolean | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          nom_scene?: string | null
          numero_agrement?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          pin_code?: string | null
          prenom_scene?: string | null
          produit_principal?: string | null
          telephone_pro?: string | null
          updated_at?: string
          user_id: string
          webauthn_credential_id?: string | null
          zone_geographique?: string | null
        }
        Update: {
          auto_analyze_docs?: boolean | null
          avatar_url?: string | null
          biometric_enabled?: boolean | null
          biometric_login_enabled?: boolean | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          nom_scene?: string | null
          numero_agrement?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          pin_code?: string | null
          prenom_scene?: string | null
          produit_principal?: string | null
          telephone_pro?: string | null
          updated_at?: string
          user_id?: string
          webauthn_credential_id?: string | null
          zone_geographique?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          updated_at?: string
          user_id?: string
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
          distance_km: number | null
          duree_minutes: number | null
          email_source_id: string | null
          etude_id: string | null
          google_event_id: string | null
          historique: Json | null
          id: string
          is_r2: boolean | null
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          needs_reconfirmation: boolean
          parent_rdv_id: string | null
          r2_type: string | null
          regie_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["rdv_status"]
          travel_time_minutes: number | null
          type_projet: Database["public"]["Enums"]["project_type"]
          type_rdv: Database["public"]["Enums"]["rdv_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse?: string | null
          client_id: string
          commentaire?: string | null
          created_at?: string
          date_heure: string
          distance_km?: number | null
          duree_minutes?: number | null
          email_source_id?: string | null
          etude_id?: string | null
          google_event_id?: string | null
          historique?: Json | null
          id?: string
          is_r2?: boolean | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          needs_reconfirmation?: boolean
          parent_rdv_id?: string | null
          r2_type?: string | null
          regie_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["rdv_status"]
          travel_time_minutes?: number | null
          type_projet?: Database["public"]["Enums"]["project_type"]
          type_rdv?: Database["public"]["Enums"]["rdv_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse?: string | null
          client_id?: string
          commentaire?: string | null
          created_at?: string
          date_heure?: string
          distance_km?: number | null
          duree_minutes?: number | null
          email_source_id?: string | null
          etude_id?: string | null
          google_event_id?: string | null
          historique?: Json | null
          id?: string
          is_r2?: boolean | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          needs_reconfirmation?: boolean
          parent_rdv_id?: string | null
          r2_type?: string | null
          regie_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["rdv_status"]
          travel_time_minutes?: number | null
          type_projet?: Database["public"]["Enums"]["project_type"]
          type_rdv?: Database["public"]["Enums"]["rdv_type"]
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
          {
            foreignKeyName: "rdv_etude_id_fkey"
            columns: ["etude_id"]
            isOneToOne: false
            referencedRelation: "etudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdv_parent_rdv_id_fkey"
            columns: ["parent_rdv_id"]
            isOneToOne: false
            referencedRelation: "rdv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdv_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
        ]
      }
      regies: {
        Row: {
          actif: boolean
          couleur: string | null
          cout_panneau_supplementaire: number | null
          created_at: string
          id: string
          is_hejja: boolean | null
          logo_url: string | null
          mode_calcul_commission: string | null
          nom: string
          part_survente_pct: number | null
          products_offered: Database["public"]["Enums"]["product_type"][] | null
          siret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean
          couleur?: string | null
          cout_panneau_supplementaire?: number | null
          created_at?: string
          id?: string
          is_hejja?: boolean | null
          logo_url?: string | null
          mode_calcul_commission?: string | null
          nom: string
          part_survente_pct?: number | null
          products_offered?:
            | Database["public"]["Enums"]["product_type"][]
            | null
          siret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean
          couleur?: string | null
          cout_panneau_supplementaire?: number | null
          created_at?: string
          id?: string
          is_hejja?: boolean | null
          logo_url?: string | null
          mode_calcul_commission?: string | null
          nom?: string
          part_survente_pct?: number | null
          products_offered?:
            | Database["public"]["Enums"]["product_type"][]
            | null
          siret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      regies_contacts: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          is_principal: boolean
          nom: string
          regie_id: string
          telephone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id?: string
          is_principal?: boolean
          nom: string
          regie_id: string
          telephone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          is_principal?: boolean
          nom?: string
          regie_id?: string
          telephone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regies_contacts_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
        ]
      }
      regies_financements: {
        Row: {
          actif: boolean
          created_at: string
          duree_mois: number
          id: string
          nom: string
          regie_id: string
          taeg: number
          taux_effectif: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          duree_mois?: number
          id?: string
          nom: string
          regie_id: string
          taeg?: number
          taux_effectif?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          duree_mois?: number
          id?: string
          nom?: string
          regie_id?: string
          taeg?: number
          taux_effectif?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regies_financements_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
        ]
      }
      regies_surcouts: {
        Row: {
          actif: boolean
          categorie: string
          code: string
          created_at: string
          id: string
          nom: string
          prix: number
          regie_id: string | null
          type_calcul: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          categorie: string
          code: string
          created_at?: string
          id?: string
          nom: string
          prix?: number
          regie_id?: string | null
          type_calcul?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          categorie?: string
          code?: string
          created_at?: string
          id?: string
          nom?: string
          prix?: number
          regie_id?: string | null
          type_calcul?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regies_surcouts_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      settings_notifications: {
        Row: {
          confirmateur_name: string | null
          confirmateur_phone: string | null
          created_at: string
          default_cq_time: string | null
          id: string
          send_to_all: boolean | null
          skip_whatsapp_prompt: boolean | null
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean | null
        }
        Insert: {
          confirmateur_name?: string | null
          confirmateur_phone?: string | null
          created_at?: string
          default_cq_time?: string | null
          id?: string
          send_to_all?: boolean | null
          skip_whatsapp_prompt?: boolean | null
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean | null
        }
        Update: {
          confirmateur_name?: string | null
          confirmateur_phone?: string | null
          created_at?: string
          default_cq_time?: string | null
          id?: string
          send_to_all?: boolean | null
          skip_whatsapp_prompt?: boolean | null
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          price_monthly: number
          price_yearly: number | null
          sort_order: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name: string
          price_monthly?: number
          price_yearly?: number | null
          sort_order?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          sort_order?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          coaching_enabled: boolean | null
          created_at: string
          daily_briefing_whatsapp: boolean | null
          gmail_last_auto_sync: string | null
          gmail_sync_enabled: boolean
          gmail_sync_interval_minutes: number
          id: string
          pipeline_alerts_enabled: boolean | null
          pipeline_stale_days: number | null
          push_enabled: boolean | null
          push_gmail_import: boolean | null
          push_new_rdv: boolean | null
          push_rappel_rdv: boolean | null
          push_vente_status: boolean | null
          rdv_prep_enabled: boolean | null
          rdv_prep_minutes_before: number | null
          rdv_prep_whatsapp: boolean | null
          relance_paiement_delay_days: number | null
          relance_paiement_enabled: boolean | null
          updated_at: string
          user_id: string
          vente_auto_transition_weeks: number
          weekly_recap_day: number | null
          weekly_recap_enabled: boolean | null
          weekly_recap_hour: number | null
          working_days: number[] | null
        }
        Insert: {
          coaching_enabled?: boolean | null
          created_at?: string
          daily_briefing_whatsapp?: boolean | null
          gmail_last_auto_sync?: string | null
          gmail_sync_enabled?: boolean
          gmail_sync_interval_minutes?: number
          id?: string
          pipeline_alerts_enabled?: boolean | null
          pipeline_stale_days?: number | null
          push_enabled?: boolean | null
          push_gmail_import?: boolean | null
          push_new_rdv?: boolean | null
          push_rappel_rdv?: boolean | null
          push_vente_status?: boolean | null
          rdv_prep_enabled?: boolean | null
          rdv_prep_minutes_before?: number | null
          rdv_prep_whatsapp?: boolean | null
          relance_paiement_delay_days?: number | null
          relance_paiement_enabled?: boolean | null
          updated_at?: string
          user_id: string
          vente_auto_transition_weeks?: number
          weekly_recap_day?: number | null
          weekly_recap_enabled?: boolean | null
          weekly_recap_hour?: number | null
          working_days?: number[] | null
        }
        Update: {
          coaching_enabled?: boolean | null
          created_at?: string
          daily_briefing_whatsapp?: boolean | null
          gmail_last_auto_sync?: string | null
          gmail_sync_enabled?: boolean
          gmail_sync_interval_minutes?: number
          id?: string
          pipeline_alerts_enabled?: boolean | null
          pipeline_stale_days?: number | null
          push_enabled?: boolean | null
          push_gmail_import?: boolean | null
          push_new_rdv?: boolean | null
          push_rappel_rdv?: boolean | null
          push_vente_status?: boolean | null
          rdv_prep_enabled?: boolean | null
          rdv_prep_minutes_before?: number | null
          rdv_prep_whatsapp?: boolean | null
          relance_paiement_delay_days?: number | null
          relance_paiement_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          vente_auto_transition_weeks?: number
          weekly_recap_day?: number | null
          weekly_recap_enabled?: boolean | null
          weekly_recap_hour?: number | null
          working_days?: number[] | null
        }
        Relationships: []
      }
      vente_status_history: {
        Row: {
          changed_at: string
          id: string
          new_status: string
          old_status: string | null
          user_id: string
          vente_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          user_id: string
          vente_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          user_id?: string
          vente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vente_status_history_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      ventes: {
        Row: {
          client_id: string
          commission_override: number | null
          created_at: string
          date_cq: string | null
          date_installation_prevue: string | null
          date_installation_reelle: string | null
          date_paiement: string | null
          date_signature: string | null
          decom_montant: number | null
          decom_raison: string | null
          etude_id: string | null
          heure_installation_prevue: string | null
          id: string
          is_retape: boolean | null
          montant_acompte: number | null
          montant_ht: number
          montant_solde: number | null
          montant_ttc: number
          nombre_panneaux: number | null
          notes: string | null
          numero_contrat: string | null
          product_type: Database["public"]["Enums"]["product_type"] | null
          puissance_kwc: number | null
          regie_id: string | null
          status: Database["public"]["Enums"]["vente_status"]
          type_installation: string | null
          type_vente: Database["public"]["Enums"]["vente_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          commission_override?: number | null
          created_at?: string
          date_cq?: string | null
          date_installation_prevue?: string | null
          date_installation_reelle?: string | null
          date_paiement?: string | null
          date_signature?: string | null
          decom_montant?: number | null
          decom_raison?: string | null
          etude_id?: string | null
          heure_installation_prevue?: string | null
          id?: string
          is_retape?: boolean | null
          montant_acompte?: number | null
          montant_ht: number
          montant_solde?: number | null
          montant_ttc: number
          nombre_panneaux?: number | null
          notes?: string | null
          numero_contrat?: string | null
          product_type?: Database["public"]["Enums"]["product_type"] | null
          puissance_kwc?: number | null
          regie_id?: string | null
          status?: Database["public"]["Enums"]["vente_status"]
          type_installation?: string | null
          type_vente?: Database["public"]["Enums"]["vente_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          commission_override?: number | null
          created_at?: string
          date_cq?: string | null
          date_installation_prevue?: string | null
          date_installation_reelle?: string | null
          date_paiement?: string | null
          date_signature?: string | null
          decom_montant?: number | null
          decom_raison?: string | null
          etude_id?: string | null
          heure_installation_prevue?: string | null
          id?: string
          is_retape?: boolean | null
          montant_acompte?: number | null
          montant_ht?: number
          montant_solde?: number | null
          montant_ttc?: number
          nombre_panneaux?: number | null
          notes?: string | null
          numero_contrat?: string | null
          product_type?: Database["public"]["Enums"]["product_type"] | null
          puissance_kwc?: number | null
          regie_id?: string | null
          status?: Database["public"]["Enums"]["vente_status"]
          type_installation?: string | null
          type_vente?: Database["public"]["Enums"]["vente_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_etude_id_fkey"
            columns: ["etude_id"]
            isOneToOne: false
            referencedRelation: "etudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_agent_actions: {
        Row: {
          action_data: Json
          action_type: string
          created_at: string
          description: string
          id: string
          is_undone: boolean | null
          message_id: string | null
          previous_data: Json | null
          target_id: string
          target_table: string
          undone_at: string | null
          user_id: string
        }
        Insert: {
          action_data?: Json
          action_type: string
          created_at?: string
          description: string
          id?: string
          is_undone?: boolean | null
          message_id?: string | null
          previous_data?: Json | null
          target_id: string
          target_table: string
          undone_at?: string | null
          user_id: string
        }
        Update: {
          action_data?: Json
          action_type?: string
          created_at?: string
          description?: string
          id?: string
          is_undone?: boolean | null
          message_id?: string | null
          previous_data?: Json | null
          target_id?: string
          target_table?: string
          undone_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_actions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_agent_memory: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          key: string
          last_used_at: string | null
          memory_type: string
          updated_at: string
          usage_count: number | null
          user_id: string
          value: Json
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          key: string
          last_used_at?: string | null
          memory_type: string
          updated_at?: string
          usage_count?: number | null
          user_id: string
          value: Json
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          key?: string
          last_used_at?: string | null
          memory_type?: string
          updated_at?: string
          usage_count?: number | null
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      whatsapp_agent_prompts: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          priority: number
          prompt_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          prompt_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          prompt_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          last_action_message_sid: string | null
          last_executed_action: Json | null
          last_message_at: string | null
          pending_action: Json | null
          pending_message_sids: Json
          phone_number: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          last_action_message_sid?: string | null
          last_executed_action?: Json | null
          last_message_at?: string | null
          pending_action?: Json | null
          pending_message_sids?: Json
          phone_number: string
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          last_action_message_sid?: string | null
          last_executed_action?: Json | null
          last_message_at?: string | null
          pending_action?: Json | null
          pending_message_sids?: Json
          phone_number?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          action_taken: string | null
          created_at: string | null
          detected_entities: Json | null
          detected_intent: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          from_number: string
          id: string
          media_types: string[] | null
          media_url: string | null
          media_urls: string[] | null
          message_type: string
          processed_at: string | null
          raw_content: string | null
          rejection_reason: string | null
          reply_to_message_id: string | null
          response_sent: string | null
          status: string | null
          transcribed_content: string | null
          twilio_message_sid: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          detected_entities?: Json | null
          detected_intent?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          media_types?: string[] | null
          media_url?: string | null
          media_urls?: string[] | null
          message_type: string
          processed_at?: string | null
          raw_content?: string | null
          rejection_reason?: string | null
          reply_to_message_id?: string | null
          response_sent?: string | null
          status?: string | null
          transcribed_content?: string | null
          twilio_message_sid?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          detected_entities?: Json | null
          detected_intent?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          media_types?: string[] | null
          media_url?: string | null
          media_urls?: string[] | null
          message_type?: string
          processed_at?: string | null
          raw_content?: string | null
          rejection_reason?: string | null
          reply_to_message_id?: string | null
          response_sent?: string | null
          status?: string | null
          transcribed_content?: string | null
          twilio_message_sid?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      whatsapp_pending_images: {
        Row: {
          created_at: string
          expires_at: string
          extracted_rdvs: Json | null
          id: string
          image_data: string
          mime_type: string | null
          phone_number: string
          regie_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          extracted_rdvs?: Json | null
          id?: string
          image_data: string
          mime_type?: string | null
          phone_number: string
          regie_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          extracted_rdvs?: Json | null
          id?: string
          image_data?: string
          mime_type?: string | null
          phone_number?: string
          regie_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_pending_images_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          classification: string
          created_at: string
          id: string
          is_active: boolean | null
          template_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          classification: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          template_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          classification?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          template_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_ticket_reply: {
        Args: { p_is_admin?: boolean; p_message: string; p_ticket_id: string }
        Returns: string
      }
      admin_force_access_state: {
        Args: { p_app_access: string; p_user_id: string }
        Returns: undefined
      }
      admin_grant_trial: {
        Args: { p_target_user_id: string; p_trial_days?: number }
        Returns: undefined
      }
      admin_update_access_state: {
        Args: { p_app_access: string; p_target_user_id: string }
        Returns: undefined
      }
      block_saas_user: { Args: { p_user_id: string }; Returns: undefined }
      calculate_vente_commission: {
        Args: { p_vente_id: string }
        Returns: Json
      }
      check_mfa_session_valid: { Args: never; Returns: boolean }
      check_signup_duplicate: {
        Args: { p_email: string; p_phone?: string }
        Returns: Json
      }
      cleanup_expired_mfa_sessions: { Args: never; Returns: number }
      clear_mfa_session: { Args: never; Returns: undefined }
      create_support_ticket: {
        Args: { p_message: string; p_subject: string }
        Returns: string
      }
      decrypt_token: { Args: { encrypted_token: string }; Returns: string }
      delete_subscription_plan: { Args: { p_id: string }; Returns: undefined }
      encrypt_token: { Args: { token: string }; Returns: string }
      find_user_by_phone: {
        Args: { p_phone: string }
        Returns: {
          app_access: string
          first_name: string
          last_name: string
          phone: string
          user_id: string
        }[]
      }
      find_user_by_stripe_customer: {
        Args: { p_stripe_customer_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_admin_users_overview: {
        Args: never
        Returns: {
          app_access: string
          beta_expires_at: string
          created_at: string
          current_period_end: string
          email: string
          first_name: string
          is_beta_tester: boolean
          last_name: string
          past_due_since: string
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_status: string
          trial_ends_at: string
          trial_started_at: string
          user_id: string
        }[]
      }
      get_all_feature_requests: {
        Args: never
        Returns: {
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
          votes: number
        }[]
      }
      get_all_saas_access_states: {
        Args: never
        Returns: {
          app_access: string
          is_beta_tester: boolean
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }[]
      }
      get_all_saas_subscriptions: {
        Args: never
        Returns: {
          current_period_end: string
          id: string
          past_due_since: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }[]
      }
      get_all_subscription_plans: {
        Args: never
        Returns: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          price_monthly: number
          price_yearly: number | null
          sort_order: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "subscription_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_all_support_tickets: {
        Args: never
        Returns: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }[]
      }
      get_audit_logs: {
        Args: { p_action_filter?: string; p_limit?: number; p_offset?: number }
        Returns: {
          action: string
          admin_email: string
          created_at: string
          details: Json
          id: string
          target_id: string
          target_type: string
        }[]
      }
      get_commissions_by_category: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_dashboard_kpis: {
        Args: { p_month?: number; p_user_id: string; p_year?: number }
        Returns: Json
      }
      get_delinquent_subscriptions: {
        Args: { p_past_due_before: string }
        Returns: {
          user_id: string
        }[]
      }
      get_expired_trials: {
        Args: { p_now: string }
        Returns: {
          trial_ends_at: string
          user_id: string
        }[]
      }
      get_frais_summary: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id: string }
        Returns: Json
      }
      get_monthly_stats: {
        Args: { p_end_date: string; p_start_date: string; p_user_id: string }
        Returns: Json
      }
      get_my_support_tickets: {
        Args: never
        Returns: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }[]
      }
      get_rdv_planning: {
        Args: {
          p_end_date: string
          p_include_cancelled?: boolean
          p_start_date: string
          p_user_id: string
        }
        Returns: Json
      }
      get_revenue_analytics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          active_users: number
          churned_users: number
          month: string
          new_signups: number
          total_users: number
          trial_users: number
        }[]
      }
      get_saas_access_state: {
        Args: { p_user_id: string }
        Returns: {
          app_access: string
          beta_expires_at: string
          is_beta_tester: boolean
          trial_ends_at: string
          trial_started_at: string
          user_id: string
        }[]
      }
      get_saas_notification_logs: {
        Args: never
        Returns: {
          audience: string
          created_at: string
          id: string
          message: string
          onesignal_response: Json
          sent_by: string
          status: string
          title: string
        }[]
      }
      get_saas_subscription: {
        Args: { p_user_id: string }
        Returns: {
          current_period_end: string
          past_due_since: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }[]
      }
      get_saas_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          first_name: string
          last_name: string
          onesignal_external_id: string
          sector: string
          user_id: string
        }[]
      }
      get_ticket_replies: {
        Args: { p_ticket_id: string }
        Returns: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }[]
      }
      get_trial_agent_facture_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_trial_expiring_soon: {
        Args: { p_from: string; p_to: string }
        Returns: {
          email: string
          first_name: string
          phone: string
          trial_ends_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_saas_admin: { Args: { p_user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_target_id?: string
          p_target_type: string
        }
        Returns: string
      }
      log_saas_notification: {
        Args: {
          p_audience: string
          p_message: string
          p_sent_by: string
          p_title: string
        }
        Returns: string
      }
      search_client_fuzzy: {
        Args: { p_limit?: number; p_query: string; p_user_id: string }
        Returns: Json
      }
      store_mfa_verification: { Args: never; Returns: string }
      toggle_beta_tester: {
        Args: { p_is_beta: boolean; p_target_user_id: string }
        Returns: undefined
      }
      undo_agent_action: { Args: { p_action_id: string }; Returns: Json }
      update_feature_status: {
        Args: { p_feature_id: string; p_status: string }
        Returns: undefined
      }
      update_saas_access_state: {
        Args: { p_app_access: string; p_user_id: string }
        Returns: undefined
      }
      update_saas_notification_log: {
        Args: { p_log_id: string; p_onesignal_response: Json; p_status: string }
        Returns: undefined
      }
      update_ticket_status: {
        Args: { p_status: string; p_ticket_id: string }
        Returns: undefined
      }
      upsert_saas_subscription: {
        Args: {
          p_current_period_end?: string
          p_status?: string
          p_stripe_customer_id: string
          p_stripe_subscription_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_subscription_plan: {
        Args: {
          p_description?: string
          p_features?: Json
          p_id?: string
          p_is_active?: boolean
          p_is_popular?: boolean
          p_name?: string
          p_price_monthly?: number
          p_price_yearly?: number
          p_sort_order?: number
          p_stripe_price_id_monthly?: string
          p_stripe_price_id_yearly?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      confirmateur_role: "principal" | "backup"
      document_type:
        | "cni"
        | "justificatif_domicile"
        | "facture_energie"
        | "bon_commande"
        | "devis"
        | "autre"
        | "facture_frais"
        | "photo_chantier"
        | "contrat"
        | "plan"
        | "assurance"
        | "photo_tableau"
        | "photo_compteur"
        | "photo_toiture"
        | "cni_monsieur_recto"
        | "cni_madame_recto"
        | "cni_monsieur_verso"
        | "cni_madame_verso"
        | "rib"
        | "avis_impots"
        | "taxe_fonciere"
        | "acte_notarie"
        | "fiche_paie_monsieur"
        | "fiche_paie_madame"
        | "attestation_retraite"
        | "attestation_invalidite"
        | "bilans"
        | "multi_docs"
      etude_verdict: "valide" | "a_etudier" | "invalide"
      frais_categorie:
        | "carburant"
        | "peage"
        | "repas"
        | "hotel"
        | "parking"
        | "autre"
        | "train"
        | "location_vehicule"
      notification_type:
        | "rappel_rdv"
        | "relance_client"
        | "commission_paye"
        | "objectif_atteint"
        | "nouveau_rdv"
        | "vente_signee"
        | "installation_prevue"
        | "autre"
      pac_subtype: "air_air" | "air_eau"
      product_type: "PV" | "PAC" | "ITE"
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
        | "porte"
      rdv_type: "standard" | "external_installation" | "installation"
      vente_status:
        | "en_negociation"
        | "signe"
        | "en_installation"
        | "installe"
        | "paye"
        | "annule"
        | "cq_a_faire"
        | "cq_fait"
        | "attente_financement"
        | "envoi_pose"
        | "attente_paiement"
        | "refus_financement"
        | "inFinancable"
        | "retracte"
        | "refus_mairie_abf"
      vente_type: "standard" | "external_installation"
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
      app_role: ["admin", "moderator", "user"],
      confirmateur_role: ["principal", "backup"],
      document_type: [
        "cni",
        "justificatif_domicile",
        "facture_energie",
        "bon_commande",
        "devis",
        "autre",
        "facture_frais",
        "photo_chantier",
        "contrat",
        "plan",
        "assurance",
        "photo_tableau",
        "photo_compteur",
        "photo_toiture",
        "cni_monsieur_recto",
        "cni_madame_recto",
        "cni_monsieur_verso",
        "cni_madame_verso",
        "rib",
        "avis_impots",
        "taxe_fonciere",
        "acte_notarie",
        "fiche_paie_monsieur",
        "fiche_paie_madame",
        "attestation_retraite",
        "attestation_invalidite",
        "bilans",
        "multi_docs",
      ],
      etude_verdict: ["valide", "a_etudier", "invalide"],
      frais_categorie: [
        "carburant",
        "peage",
        "repas",
        "hotel",
        "parking",
        "autre",
        "train",
        "location_vehicule",
      ],
      notification_type: [
        "rappel_rdv",
        "relance_client",
        "commission_paye",
        "objectif_atteint",
        "nouveau_rdv",
        "vente_signee",
        "installation_prevue",
        "autre",
      ],
      pac_subtype: ["air_air", "air_eau"],
      product_type: ["PV", "PAC", "ITE"],
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
        "porte",
      ],
      rdv_type: ["standard", "external_installation", "installation"],
      vente_status: [
        "en_negociation",
        "signe",
        "en_installation",
        "installe",
        "paye",
        "annule",
        "cq_a_faire",
        "cq_fait",
        "attente_financement",
        "envoi_pose",
        "attente_paiement",
        "refus_financement",
        "inFinancable",
        "retracte",
        "refus_mairie_abf",
      ],
      vente_type: ["standard", "external_installation"],
    },
  },
} as const
