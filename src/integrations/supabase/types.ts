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
          latitude: number | null
          longitude: number | null
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
          latitude?: number | null
          longitude?: number | null
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
          latitude?: number | null
          longitude?: number | null
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
      data_calibres: {
        Row: {
          actif: boolean
          calibre_amperes: number
          created_at: string
          id: string
          intensite_max_a: number
          puissance_kva: number
          usage_typique: string | null
        }
        Insert: {
          actif?: boolean
          calibre_amperes: number
          created_at?: string
          id?: string
          intensite_max_a: number
          puissance_kva: number
          usage_typique?: string | null
        }
        Update: {
          actif?: boolean
          calibre_amperes?: number
          created_at?: string
          id?: string
          intensite_max_a?: number
          puissance_kva?: number
          usage_typique?: string | null
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
      data_compteurs: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          montant: number
          type_compteur: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          montant?: number
          type_compteur: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          montant?: number
          type_compteur?: string
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
          commission_fixe: number | null
          commission_hejja: number | null
          commission_pct: number | null
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
          commission_fixe?: number | null
          commission_hejja?: number | null
          commission_pct?: number | null
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
          commission_fixe?: number | null
          commission_hejja?: number | null
          commission_pct?: number | null
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
          heures_ensoleillement_annuel: number | null
          id: string
          jours_ensoleillement_pauvre: number | null
          jours_ensoleillement_riche: number | null
          max_psh_value: number
          psh_value: number
          updated_at: string
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
          distance_km: number | null
          duree_minutes: number | null
          email_source_id: string | null
          google_event_id: string | null
          historique: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          source: string | null
          status: Database["public"]["Enums"]["rdv_status"]
          travel_time_minutes: number | null
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
          distance_km?: number | null
          duree_minutes?: number | null
          email_source_id?: string | null
          google_event_id?: string | null
          historique?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["rdv_status"]
          travel_time_minutes?: number | null
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
          distance_km?: number | null
          duree_minutes?: number | null
          email_source_id?: string | null
          google_event_id?: string | null
          historique?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["rdv_status"]
          travel_time_minutes?: number | null
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
      ventes: {
        Row: {
          client_id: string
          created_at: string
          date_installation_prevue: string | null
          date_installation_reelle: string | null
          date_paiement: string | null
          date_signature: string | null
          etude_id: string | null
          id: string
          montant_acompte: number | null
          montant_ht: number
          montant_solde: number | null
          montant_ttc: number
          nombre_panneaux: number | null
          notes: string | null
          numero_contrat: string | null
          puissance_kwc: number | null
          status: Database["public"]["Enums"]["vente_status"]
          type_installation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date_installation_prevue?: string | null
          date_installation_reelle?: string | null
          date_paiement?: string | null
          date_signature?: string | null
          etude_id?: string | null
          id?: string
          montant_acompte?: number | null
          montant_ht: number
          montant_solde?: number | null
          montant_ttc: number
          nombre_panneaux?: number | null
          notes?: string | null
          numero_contrat?: string | null
          puissance_kwc?: number | null
          status?: Database["public"]["Enums"]["vente_status"]
          type_installation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date_installation_prevue?: string | null
          date_installation_reelle?: string | null
          date_paiement?: string | null
          date_signature?: string | null
          etude_id?: string | null
          id?: string
          montant_acompte?: number | null
          montant_ht?: number
          montant_solde?: number | null
          montant_ttc?: number
          nombre_panneaux?: number | null
          notes?: string | null
          numero_contrat?: string | null
          puissance_kwc?: number | null
          status?: Database["public"]["Enums"]["vente_status"]
          type_installation?: string | null
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      notification_type:
        | "rappel_rdv"
        | "relance_client"
        | "commission_paye"
        | "objectif_atteint"
        | "nouveau_rdv"
        | "vente_signee"
        | "installation_prevue"
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
      vente_status:
        | "en_negociation"
        | "signe"
        | "en_installation"
        | "installe"
        | "paye"
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
      app_role: ["admin", "moderator", "user"],
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
      vente_status: [
        "en_negociation",
        "signe",
        "en_installation",
        "installe",
        "paye",
        "annule",
      ],
    },
  },
} as const
