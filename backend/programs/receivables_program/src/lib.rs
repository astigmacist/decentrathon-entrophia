use anchor_lang::prelude::*;

pub mod constants;

declare_id!("REPLACE_WITH_RECEIVABLES_PROGRAM_ID");

pub const ROLE_ISSUER: u32 = 1 << 0;
pub const ROLE_INVESTOR: u32 = 1 << 1;
pub const ROLE_VERIFIER: u32 = 1 << 2;
pub const ROLE_ADMIN: u32 = 1 << 3;
pub const ROLE_ATTESTOR: u32 = 1 << 4;

#[program]
pub mod receivables_program {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        platform_fee_bps: u16,
        usdc_mint: Pubkey,
    ) -> Result<()> {
        require!(platform_fee_bps <= 10_000, ReceivablesError::InvalidBasisPoints);
        let config = &mut ctx.accounts.platform_config;
        config.admin = ctx.accounts.admin.key();
        config.verifier_authority = ctx.accounts.verifier_authority.key();
        config.attestor_authority = ctx.accounts.attestor_authority.key();
        config.usdc_mint = usdc_mint;
        config.platform_fee_bps = platform_fee_bps;
        config.paused = false;
        Ok(())
    }

    pub fn upsert_whitelist_entry(
        ctx: Context<UpsertWhitelistEntry>,
        role_mask: u32,
        active: bool,
        kyc_ref_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let entry = &mut ctx.accounts.whitelist_entry;
        entry.wallet = ctx.accounts.wallet.key();
        entry.role_mask = role_mask;
        entry.active = active;
        entry.kyc_ref_hash = kyc_ref_hash;
        entry.updated_at = now;
        Ok(())
    }

    pub fn create_asset(
        ctx: Context<CreateAsset>,
        asset_id: String,
        invoice_hash: [u8; 32],
        metadata_uri: String,
        debtor_ref_hash: [u8; 32],
        face_value: u64,
        discount_bps: u16,
        funding_target: u64,
        due_date: i64,
    ) -> Result<()> {
        require!(face_value > 0, ReceivablesError::InvalidAmount);
        require!(funding_target > 0, ReceivablesError::InvalidAmount);
        require!(discount_bps > 0 && discount_bps <= 10_000, ReceivablesError::InvalidBasisPoints);

        let asset = &mut ctx.accounts.asset;
        asset.asset_id = asset_id.clone();
        asset.issuer = ctx.accounts.issuer.key();
        asset.invoice_hash = invoice_hash;
        asset.metadata_uri = metadata_uri;
        asset.debtor_ref_hash = debtor_ref_hash;
        asset.face_value = face_value;
        asset.discount_bps = discount_bps;
        asset.funding_target = funding_target;
        asset.due_date = due_date;
        asset.status = AssetStatus::Created;
        asset.mint = Pubkey::default();
        asset.asset_token_vault = Pubkey::default();
        asset.funding_vault = Pubkey::default();
        asset.payout_vault = Pubkey::default();
        asset.total_contributed_usdc = 0;
        asset.total_asset_tokens_issued = 0;
        asset.payout_pool_usdc = 0;
        asset.claimed_total_usdc = 0;
        asset.funding_settled = false;

        emit!(AssetCreated {
            asset: ctx.accounts.asset.key(),
            asset_id,
            issuer: ctx.accounts.issuer.key(),
            funding_target,
        });
        Ok(())
    }

    pub fn verify_asset(ctx: Context<VerifyAsset>) -> Result<()> {
        require!(
            ctx.accounts.verifier.key() == ctx.accounts.platform_config.verifier_authority
                || ctx.accounts.verifier.key() == ctx.accounts.platform_config.admin,
            ReceivablesError::RoleNotAllowed
        );
        let asset = &mut ctx.accounts.asset;
        assert_transition(asset.status, AssetStatus::Verified)?;
        asset.status = AssetStatus::Verified;
        emit!(AssetVerified {
            asset: asset.key(),
            verifier: ctx.accounts.verifier.key(),
        });
        Ok(())
    }

    pub fn initialize_asset_mint(
        ctx: Context<InitializeAssetMint>,
        mint: Pubkey,
        asset_token_vault: Pubkey,
        funding_vault: Pubkey,
        payout_vault: Pubkey,
    ) -> Result<()> {
        let asset = &mut ctx.accounts.asset;
        require!(asset.status == AssetStatus::Verified, ReceivablesError::InvalidAssetStatus);
        require!(asset.mint == Pubkey::default(), ReceivablesError::MintAlreadyInitialized);
        asset.mint = mint;
        asset.asset_token_vault = asset_token_vault;
        asset.funding_vault = funding_vault;
        asset.payout_vault = payout_vault;
        Ok(())
    }

    pub fn open_funding(ctx: Context<OpenFunding>) -> Result<()> {
        require!(
            ctx.accounts.operator.key() == ctx.accounts.platform_config.verifier_authority
                || ctx.accounts.operator.key() == ctx.accounts.platform_config.admin,
            ReceivablesError::RoleNotAllowed
        );
        let asset = &mut ctx.accounts.asset;
        assert_transition(asset.status, AssetStatus::FundingOpen)?;
        asset.status = AssetStatus::FundingOpen;
        emit!(FundingOpened {
            asset: asset.key(),
            opened_by: ctx.accounts.operator.key(),
        });
        Ok(())
    }

    pub fn buy_primary(ctx: Context<BuyPrimary>, amount_usdc: u64) -> Result<()> {
        require!(amount_usdc > 0, ReceivablesError::InvalidAmount);
        let asset = &mut ctx.accounts.asset;
        require!(asset.status == AssetStatus::FundingOpen, ReceivablesError::InvalidAssetStatus);
        require!(ctx.accounts.investor_whitelist.active, ReceivablesError::WalletNotAllowlisted);
        require!(
            (ctx.accounts.investor_whitelist.role_mask & ROLE_INVESTOR) != 0,
            ReceivablesError::RoleNotAllowed
        );

        let received_asset_tokens = amount_usdc;
        asset.total_contributed_usdc = asset
            .total_contributed_usdc
            .checked_add(amount_usdc)
            .ok_or(ReceivablesError::MathOverflow)?;
        asset.total_asset_tokens_issued = asset
            .total_asset_tokens_issued
            .checked_add(received_asset_tokens)
            .ok_or(ReceivablesError::MathOverflow)?;

        let receipt = &mut ctx.accounts.investment_receipt;
        receipt.asset = asset.key();
        receipt.investor = ctx.accounts.investor.key();
        receipt.contributed_usdc = receipt
            .contributed_usdc
            .checked_add(amount_usdc)
            .ok_or(ReceivablesError::MathOverflow)?;
        receipt.received_asset_tokens = receipt
            .received_asset_tokens
            .checked_add(received_asset_tokens)
            .ok_or(ReceivablesError::MathOverflow)?;
        receipt.refunded = false;

        emit!(PrimaryBought {
            asset: asset.key(),
            investor: ctx.accounts.investor.key(),
            amount_usdc,
            received_asset_tokens,
        });
        Ok(())
    }

    pub fn close_funding(ctx: Context<CloseFunding>) -> Result<()> {
        require!(
            ctx.accounts.operator.key() == ctx.accounts.platform_config.verifier_authority
                || ctx.accounts.operator.key() == ctx.accounts.platform_config.admin,
            ReceivablesError::RoleNotAllowed
        );
        let asset = &mut ctx.accounts.asset;
        require!(asset.status == AssetStatus::FundingOpen, ReceivablesError::InvalidAssetStatus);
        let next = if asset.total_contributed_usdc >= asset.funding_target {
            AssetStatus::Funded
        } else {
            AssetStatus::Cancelled
        };
        assert_transition(asset.status, next)?;
        asset.status = next;
        emit!(FundingClosed {
            asset: asset.key(),
            closed_by: ctx.accounts.operator.key(),
            status: asset.status,
            total_contributed_usdc: asset.total_contributed_usdc,
        });
        Ok(())
    }

    pub fn settle_funding_to_issuer(ctx: Context<SettleFundingToIssuer>) -> Result<()> {
        require!(
            ctx.accounts.operator.key() == ctx.accounts.platform_config.admin,
            ReceivablesError::RoleNotAllowed
        );
        let asset = &mut ctx.accounts.asset;
        require!(asset.status == AssetStatus::Funded, ReceivablesError::InvalidAssetStatus);
        require!(!asset.funding_settled, ReceivablesError::FundingAlreadySettled);
        asset.funding_settled = true;
        Ok(())
    }

    pub fn record_payment(ctx: Context<RecordPayment>, payment_amount_usdc: u64) -> Result<()> {
        require!(
            ctx.accounts.attestor.key() == ctx.accounts.platform_config.attestor_authority
                || ctx.accounts.attestor.key() == ctx.accounts.platform_config.admin,
            ReceivablesError::RoleNotAllowed
        );
        require!(payment_amount_usdc > 0, ReceivablesError::InvalidAmount);
        let asset = &mut ctx.accounts.asset;
        assert_transition(asset.status, AssetStatus::Paid)?;
        asset.payout_pool_usdc = payment_amount_usdc;
        asset.claimed_total_usdc = 0;
        asset.status = AssetStatus::Paid;

        emit!(PaymentRecorded {
            asset: asset.key(),
            attestor: ctx.accounts.attestor.key(),
            payment_amount_usdc,
        });
        Ok(())
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let asset = &mut ctx.accounts.asset;
        require!(asset.status == AssetStatus::Paid, ReceivablesError::InvalidAssetStatus);

        let receipt = &mut ctx.accounts.investment_receipt;
        require!(!receipt.refunded, ReceivablesError::RefundedReceiptCannotClaim);
        require!(
            asset.total_asset_tokens_issued > 0 && receipt.received_asset_tokens > 0,
            ReceivablesError::InvalidAmount
        );

        let payout_pool = u128::from(asset.payout_pool_usdc);
        let user_tokens = u128::from(receipt.received_asset_tokens);
        let total_tokens = u128::from(asset.total_asset_tokens_issued);
        let entitlement_u128 = payout_pool
            .checked_mul(user_tokens)
            .ok_or(ReceivablesError::MathOverflow)?
            .checked_div(total_tokens)
            .ok_or(ReceivablesError::MathOverflow)?;
        let entitlement = u64::try_from(entitlement_u128).map_err(|_| error!(ReceivablesError::MathOverflow))?;

        if receipt.claimed_payout_usdc >= entitlement {
            // idempotent retry
            return Ok(());
        }

        let delta = entitlement
            .checked_sub(receipt.claimed_payout_usdc)
            .ok_or(ReceivablesError::MathOverflow)?;
        receipt.claimed_payout_usdc = entitlement;
        asset.claimed_total_usdc = asset
            .claimed_total_usdc
            .checked_add(delta)
            .ok_or(ReceivablesError::MathOverflow)?;

        emit!(PayoutClaimed {
            asset: asset.key(),
            investor: receipt.investor,
            claim_amount_usdc: delta,
            cumulative_claimed_usdc: receipt.claimed_payout_usdc,
        });
        Ok(())
    }

    pub fn finalize_asset(ctx: Context<FinalizeAsset>) -> Result<()> {
        require!(
            ctx.accounts.operator.key() == ctx.accounts.platform_config.admin,
            ReceivablesError::RoleNotAllowed
        );
        let asset = &mut ctx.accounts.asset;
        assert_transition(asset.status, AssetStatus::Closed)?;
        require!(
            asset.claimed_total_usdc >= asset.payout_pool_usdc,
            ReceivablesError::OutstandingPayoutExists
        );
        asset.status = AssetStatus::Closed;
        emit!(AssetFinalized {
            asset: asset.key(),
            finalized_by: ctx.accounts.operator.key(),
        });
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let asset = &ctx.accounts.asset;
        require!(asset.status == AssetStatus::Cancelled, ReceivablesError::InvalidAssetStatus);
        let receipt = &mut ctx.accounts.investment_receipt;
        if receipt.refunded {
            // idempotent retry
            return Ok(());
        }
        receipt.refunded = true;
        emit!(Refunded {
            asset: asset.key(),
            investor: receipt.investor,
            refunded_usdc: receipt.contributed_usdc,
        });
        Ok(())
    }

    pub fn validate_transfer(ctx: Context<ValidateTransfer>) -> Result<()> {
        let asset = &ctx.accounts.asset;
        require!(!asset.is_transfer_blocked(), ReceivablesError::TransferBlockedByStatus);
        require!(ctx.accounts.from_whitelist.active, ReceivablesError::FromNotAllowlisted);
        require!(ctx.accounts.to_whitelist.active, ReceivablesError::ToNotAllowlisted);
        Ok(())
    }
}

fn assert_transition(from: AssetStatus, to: AssetStatus) -> Result<()> {
    let allowed = matches!(
        (from, to),
        (AssetStatus::Created, AssetStatus::Verified)
            | (AssetStatus::Verified, AssetStatus::FundingOpen)
            | (AssetStatus::FundingOpen, AssetStatus::Funded)
            | (AssetStatus::FundingOpen, AssetStatus::Cancelled)
            | (AssetStatus::Funded, AssetStatus::Paid)
            | (AssetStatus::Paid, AssetStatus::Closed)
    );
    require!(allowed, ReceivablesError::InvalidStatusTransition);
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: authority-only input account
    pub verifier_authority: UncheckedAccount<'info>,
    /// CHECK: authority-only input account
    pub attestor_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [constants::SEED_PLATFORM_CONFIG],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpsertWhitelistEntry<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [constants::SEED_PLATFORM_CONFIG],
        bump,
        has_one = admin
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    /// CHECK: wallet PDA key source
    pub wallet: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + WhitelistEntry::INIT_SPACE,
        seeds = [constants::SEED_WHITELIST_ENTRY, wallet.key().as_ref()],
        bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct CreateAsset<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(
        init,
        payer = issuer,
        space = 8 + Asset::INIT_SPACE,
        seeds = [constants::SEED_ASSET, asset_id.as_bytes()],
        bump
    )]
    pub asset: Account<'info, Asset>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyAsset<'info> {
    pub verifier: Signer<'info>,
    #[account(seeds = [constants::SEED_PLATFORM_CONFIG], bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct InitializeAssetMint<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(
        seeds = [constants::SEED_PLATFORM_CONFIG],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut, has_one = issuer)]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct OpenFunding<'info> {
    pub operator: Signer<'info>,
    #[account(seeds = [constants::SEED_PLATFORM_CONFIG], bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct BuyPrimary<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
    #[account(
        seeds = [constants::SEED_WHITELIST_ENTRY, investor.key().as_ref()],
        bump,
    )]
    pub investor_whitelist: Account<'info, WhitelistEntry>,
    #[account(
        init_if_needed,
        payer = investor,
        space = 8 + InvestmentReceipt::INIT_SPACE,
        seeds = [constants::SEED_INVESTMENT_RECEIPT, asset.key().as_ref(), investor.key().as_ref()],
        bump
    )]
    pub investment_receipt: Account<'info, InvestmentReceipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseFunding<'info> {
    pub operator: Signer<'info>,
    #[account(seeds = [constants::SEED_PLATFORM_CONFIG], bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct SettleFundingToIssuer<'info> {
    pub operator: Signer<'info>,
    #[account(seeds = [constants::SEED_PLATFORM_CONFIG], bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct RecordPayment<'info> {
    pub attestor: Signer<'info>,
    #[account(seeds = [constants::SEED_PLATFORM_CONFIG], bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    pub investor: Signer<'info>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
    #[account(
        mut,
        seeds = [constants::SEED_INVESTMENT_RECEIPT, asset.key().as_ref(), investor.key().as_ref()],
        bump,
        has_one = asset,
        has_one = investor
    )]
    pub investment_receipt: Account<'info, InvestmentReceipt>,
}

#[derive(Accounts)]
pub struct FinalizeAsset<'info> {
    pub operator: Signer<'info>,
    #[account(seeds = [constants::SEED_PLATFORM_CONFIG], bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    pub investor: Signer<'info>,
    pub asset: Account<'info, Asset>,
    #[account(
        mut,
        seeds = [constants::SEED_INVESTMENT_RECEIPT, asset.key().as_ref(), investor.key().as_ref()],
        bump,
        has_one = asset,
        has_one = investor
    )]
    pub investment_receipt: Account<'info, InvestmentReceipt>,
}

#[derive(Accounts)]
pub struct ValidateTransfer<'info> {
    pub asset: Account<'info, Asset>,
    /// CHECK: sender wallet lookup
    pub from_wallet: UncheckedAccount<'info>,
    /// CHECK: recipient wallet lookup
    pub to_wallet: UncheckedAccount<'info>,
    #[account(
        seeds = [constants::SEED_WHITELIST_ENTRY, from_wallet.key().as_ref()],
        bump
    )]
    pub from_whitelist: Account<'info, WhitelistEntry>,
    #[account(
        seeds = [constants::SEED_WHITELIST_ENTRY, to_wallet.key().as_ref()],
        bump
    )]
    pub to_whitelist: Account<'info, WhitelistEntry>,
}

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub verifier_authority: Pubkey,
    pub attestor_authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub platform_fee_bps: u16,
    pub paused: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Asset {
    #[max_len(64)]
    pub asset_id: String,
    pub issuer: Pubkey,
    pub invoice_hash: [u8; 32],
    #[max_len(256)]
    pub metadata_uri: String,
    pub debtor_ref_hash: [u8; 32],
    pub face_value: u64,
    pub discount_bps: u16,
    pub funding_target: u64,
    pub due_date: i64,
    pub status: AssetStatus,
    pub mint: Pubkey,
    pub asset_token_vault: Pubkey,
    pub funding_vault: Pubkey,
    pub payout_vault: Pubkey,
    pub total_contributed_usdc: u64,
    pub total_asset_tokens_issued: u64,
    pub payout_pool_usdc: u64,
    pub claimed_total_usdc: u64,
    pub funding_settled: bool,
}

impl Asset {
    pub fn is_transfer_blocked(&self) -> bool {
        matches!(
            self.status,
            AssetStatus::Paid | AssetStatus::Closed | AssetStatus::Cancelled
        )
    }
}

#[account]
#[derive(InitSpace)]
pub struct WhitelistEntry {
    pub wallet: Pubkey,
    pub role_mask: u32,
    pub active: bool,
    pub kyc_ref_hash: [u8; 32],
    pub updated_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct InvestmentReceipt {
    pub asset: Pubkey,
    pub investor: Pubkey,
    pub contributed_usdc: u64,
    pub received_asset_tokens: u64,
    pub claimed_payout_usdc: u64,
    pub refunded: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq, InitSpace)]
pub enum AssetStatus {
    Created,
    Verified,
    FundingOpen,
    Funded,
    Paid,
    Cancelled,
    Closed,
}

#[event]
pub struct AssetCreated {
    pub asset: Pubkey,
    pub asset_id: String,
    pub issuer: Pubkey,
    pub funding_target: u64,
}

#[event]
pub struct AssetVerified {
    pub asset: Pubkey,
    pub verifier: Pubkey,
}

#[event]
pub struct FundingOpened {
    pub asset: Pubkey,
    pub opened_by: Pubkey,
}

#[event]
pub struct PrimaryBought {
    pub asset: Pubkey,
    pub investor: Pubkey,
    pub amount_usdc: u64,
    pub received_asset_tokens: u64,
}

#[event]
pub struct FundingClosed {
    pub asset: Pubkey,
    pub closed_by: Pubkey,
    pub status: AssetStatus,
    pub total_contributed_usdc: u64,
}

#[event]
pub struct PaymentRecorded {
    pub asset: Pubkey,
    pub attestor: Pubkey,
    pub payment_amount_usdc: u64,
}

#[event]
pub struct PayoutClaimed {
    pub asset: Pubkey,
    pub investor: Pubkey,
    pub claim_amount_usdc: u64,
    pub cumulative_claimed_usdc: u64,
}

#[event]
pub struct AssetFinalized {
    pub asset: Pubkey,
    pub finalized_by: Pubkey,
}

#[event]
pub struct Refunded {
    pub asset: Pubkey,
    pub investor: Pubkey,
    pub refunded_usdc: u64,
}

#[error_code]
pub enum ReceivablesError {
    #[msg("Invalid status transition.")]
    InvalidStatusTransition,
    #[msg("Invalid asset status.")]
    InvalidAssetStatus,
    #[msg("Role is not allowed for this action.")]
    RoleNotAllowed,
    #[msg("Wallet is not allowlisted.")]
    WalletNotAllowlisted,
    #[msg("Math overflow.")]
    MathOverflow,
    #[msg("Invalid basis points value.")]
    InvalidBasisPoints,
    #[msg("Invalid amount.")]
    InvalidAmount,
    #[msg("Mint already initialized.")]
    MintAlreadyInitialized,
    #[msg("Funding already settled.")]
    FundingAlreadySettled,
    #[msg("Receipt already refunded.")]
    ReceiptAlreadyRefunded,
    #[msg("Refunded receipt cannot claim payout.")]
    RefundedReceiptCannotClaim,
    #[msg("Outstanding payout exists.")]
    OutstandingPayoutExists,
    #[msg("Transfer is blocked by asset status.")]
    TransferBlockedByStatus,
    #[msg("From wallet is not allowlisted.")]
    FromNotAllowlisted,
    #[msg("To wallet is not allowlisted.")]
    ToNotAllowlisted,
}
