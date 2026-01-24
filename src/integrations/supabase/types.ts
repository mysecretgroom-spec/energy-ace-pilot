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
          taux_commission: number
          tranche_max: number
          tranche_min: number
          user_id: string | null
        }
        Insert: {
          bonus_survente?: number | null
          created_at?: string
          id?: string
          taux_commission: number
          tranche_max?: number
          tranche_min?: number
          user_id?: string | null
        }
        Update: {
          bonus_survente?: number | null
          created_at?: string
          id?: string
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
      data_prix_bouquets: {
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
          puissance_kwc: number
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
          puissance_kwc: number
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
          puissance_kwc?: number
          updated_at?: string
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
      documents: {
        Row: {
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
          taille_bytes: number | null
          thumbnails_urls: string[] | null
          type_document: Database["public"]["Enums"]["document_type"]
          url: string
          user_id: string
        }
        Insert: {
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
          taille_bytes?: number | null
          thumbnails_urls?: string[] | null
          type_document?: Database["public"]["Enums"]["document_type"]
          url: string
          user_id: string
        }
        Update: {
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
          mensualite_estimee: number | null
          mode_financement: string | null
          mode_hejja_prix: boolean | null
          mode_hejja_psh: boolean | null
          nombre_panneaux: number | null
          notes: string | null
          numero_pdl: string | null
          ombre_toiture: string | null
          orientation: string | null
          photo_compteur: string | null
          photo_inclinaison: string | null
          photo_tableau: string | null
          photo_toiture: string | null
          potentiel_faisabilite: string | null
          prime_autoconsommation: number | null
          prix_installation: number | null
          prix_total: number | null
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
          mensualite_estimee?: number | null
          mode_financement?: string | null
          mode_hejja_prix?: boolean | null
          mode_hejja_psh?: boolean | null
          nombre_panneaux?: number | null
          notes?: string | null
          numero_pdl?: string | null
          ombre_toiture?: string | null
          orientation?: string | null
          photo_compteur?: string | null
          photo_inclinaison?: string | null
          photo_tableau?: string | null
          photo_toiture?: string | null
          potentiel_faisabilite?: string | null
          prime_autoconsommation?: number | null
          prix_installation?: number | null
          prix_total?: number | null
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
          mensualite_estimee?: number | null
          mode_financement?: string | null
          mode_hejja_prix?: boolean | null
          mode_hejja_psh?: boolean | null
          nombre_panneaux?: number | null
          notes?: string | null
          numero_pdl?: string | null
          ombre_toiture?: string | null
          orientation?: string | null
          photo_compteur?: string | null
          photo_inclinaison?: string | null
          photo_tableau?: string | null
          photo_toiture?: string | null
          potentiel_faisabilite?: string | null
          prime_autoconsommation?: number | null
          prix_installation?: number | null
          prix_total?: number | null
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
      frais: {
        Row: {
          categorie: Database["public"]["Enums"]["frais_categorie"]
          created_at: string
          date_debut: string | null
          date_fin: string | null
          date_frais: string
          description: string | null
          document_id: string | null
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
          avatar_url: string | null
          biometric_enabled: boolean | null
          biometric_login_enabled: boolean | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          onboarding_completed: boolean
          phone: string | null
          pin_code: string | null
          updated_at: string
          user_id: string
          webauthn_credential_id: string | null
          zone_geographique: string | null
        }
        Insert: {
          avatar_url?: string | null
          biometric_enabled?: boolean | null
          biometric_login_enabled?: boolean | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          pin_code?: string | null
          updated_at?: string
          user_id: string
          webauthn_credential_id?: string | null
          zone_geographique?: string | null
        }
        Update: {
          avatar_url?: string | null
          biometric_enabled?: boolean | null
          biometric_login_enabled?: boolean | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          pin_code?: string | null
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
          created_at: string
          id: string
          is_hejja: boolean | null
          logo_url: string | null
          mode_calcul_commission: string | null
          nom: string
          part_survente_pct: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean
          couleur?: string | null
          created_at?: string
          id?: string
          is_hejja?: boolean | null
          logo_url?: string | null
          mode_calcul_commission?: string | null
          nom: string
          part_survente_pct?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean
          couleur?: string | null
          created_at?: string
          id?: string
          is_hejja?: boolean | null
          logo_url?: string | null
          mode_calcul_commission?: string | null
          nom?: string
          part_survente_pct?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      regies_bouquets: {
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
          puissance_kwc: number
          regie_id: string
          updated_at: string
          user_id: string
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
          prix_max?: number
          prix_recommande?: number
          puissance_kwc: number
          regie_id: string
          updated_at?: string
          user_id: string
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
          puissance_kwc?: number
          regie_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regies_bouquets_regie_id_fkey"
            columns: ["regie_id"]
            isOneToOne: false
            referencedRelation: "regies"
            referencedColumns: ["id"]
          },
        ]
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
          regie_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean
          categorie: string
          code: string
          created_at?: string
          id?: string
          nom: string
          prix?: number
          regie_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean
          categorie?: string
          code?: string
          created_at?: string
          id?: string
          nom?: string
          prix?: number
          regie_id?: string
          updated_at?: string
          user_id?: string
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
          created_at: string
          gmail_last_auto_sync: string | null
          gmail_sync_enabled: boolean
          gmail_sync_interval_minutes: number
          id: string
          push_enabled: boolean | null
          push_gmail_import: boolean | null
          push_new_rdv: boolean | null
          push_rappel_rdv: boolean | null
          push_vente_status: boolean | null
          updated_at: string
          user_id: string
          vente_auto_transition_weeks: number
        }
        Insert: {
          created_at?: string
          gmail_last_auto_sync?: string | null
          gmail_sync_enabled?: boolean
          gmail_sync_interval_minutes?: number
          id?: string
          push_enabled?: boolean | null
          push_gmail_import?: boolean | null
          push_new_rdv?: boolean | null
          push_rappel_rdv?: boolean | null
          push_vente_status?: boolean | null
          updated_at?: string
          user_id: string
          vente_auto_transition_weeks?: number
        }
        Update: {
          created_at?: string
          gmail_last_auto_sync?: string | null
          gmail_sync_enabled?: boolean
          gmail_sync_interval_minutes?: number
          id?: string
          push_enabled?: boolean | null
          push_gmail_import?: boolean | null
          push_new_rdv?: boolean | null
          push_rappel_rdv?: boolean | null
          push_vente_status?: boolean | null
          updated_at?: string
          user_id?: string
          vente_auto_transition_weeks?: number
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
          date_pose: string | null
          date_signature: string | null
          decom_montant: number | null
          decom_raison: string | null
          etude_id: string | null
          id: string
          is_retape: boolean | null
          montant_acompte: number | null
          montant_ht: number
          montant_solde: number | null
          montant_ttc: number
          nombre_panneaux: number | null
          notes: string | null
          numero_contrat: string | null
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
          created_at?: string
          date_installation_prevue?: string | null
          date_installation_reelle?: string | null
          date_paiement?: string | null
          date_pose?: string | null
          date_signature?: string | null
          decom_montant?: number | null
          decom_raison?: string | null
          etude_id?: string | null
          id?: string
          is_retape?: boolean | null
          montant_acompte?: number | null
          montant_ht: number
          montant_solde?: number | null
          montant_ttc: number
          nombre_panneaux?: number | null
          notes?: string | null
          numero_contrat?: string | null
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
          created_at?: string
          date_installation_prevue?: string | null
          date_installation_reelle?: string | null
          date_paiement?: string | null
          date_pose?: string | null
          date_signature?: string | null
          decom_montant?: number | null
          decom_raison?: string | null
          etude_id?: string | null
          id?: string
          is_retape?: boolean | null
          montant_acompte?: number | null
          montant_ht?: number
          montant_solde?: number | null
          montant_ttc?: number
          nombre_panneaux?: number | null
          notes?: string | null
          numero_contrat?: string | null
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
      block_saas_user: { Args: { p_user_id: string }; Returns: undefined }
      create_support_ticket: {
        Args: { p_message: string; p_subject: string }
        Returns: string
      }
      decrypt_token: { Args: { encrypted_token: string }; Returns: string }
      encrypt_token: { Args: { token: string }; Returns: string }
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
      get_saas_access_state: {
        Args: { p_user_id: string }
        Returns: {
          app_access: string
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_saas_admin: { Args: { p_user_id: string }; Returns: boolean }
      log_saas_notification: {
        Args: {
          p_audience: string
          p_message: string
          p_sent_by: string
          p_title: string
        }
        Returns: string
      }
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
      rdv_type: "standard" | "external_installation"
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
      rdv_type: ["standard", "external_installation"],
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
      ],
      vente_type: ["standard", "external_installation"],
    },
  },
} as const
