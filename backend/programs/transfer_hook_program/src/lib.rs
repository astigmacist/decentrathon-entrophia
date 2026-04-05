use anchor_lang::prelude::*;

pub mod constants;

declare_id!("REPLACE_WITH_TRANSFER_HOOK_PROGRAM_ID");

#[program]
pub mod transfer_hook_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let cfg = &mut ctx.accounts.transfer_hook_config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.receivables_program_id = Pubkey::default();
        cfg.transfers_blocked_after_paid = true;
        Ok(())
    }

    pub fn set_receivables_program(
        ctx: Context<SetReceivablesProgram>,
        receivables_program_id: Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.transfer_hook_config;
        cfg.receivables_program_id = receivables_program_id;
        Ok(())
    }

    pub fn upsert_allowlist_entry(ctx: Context<UpsertAllowlistEntry>, active: bool) -> Result<()> {
        let entry = &mut ctx.accounts.allowlist_entry;
        entry.wallet = ctx.accounts.wallet.key();
        entry.active = active;
        Ok(())
    }

    pub fn upsert_asset_state(
        ctx: Context<UpsertAssetState>,
        blocked_by_status: bool,
    ) -> Result<()> {
        let state = &mut ctx.accounts.asset_state;
        state.asset = ctx.accounts.asset.key();
        state.blocked_by_status = blocked_by_status;
        Ok(())
    }

    pub fn validate_transfer(ctx: Context<ValidateTransfer>) -> Result<()> {
        require!(ctx.accounts.from_allowlist.active, HookError::FromNotAllowlisted);
        require!(ctx.accounts.to_allowlist.active, HookError::ToNotAllowlisted);
        require!(
            !ctx.accounts.asset_state.blocked_by_status,
            HookError::AssetStatusBlocked
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + TransferHookConfig::INIT_SPACE,
        seeds = [constants::SEED_HOOK_CONFIG],
        bump
    )]
    pub transfer_hook_config: Account<'info, TransferHookConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetReceivablesProgram<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        has_one = admin,
        seeds = [constants::SEED_HOOK_CONFIG],
        bump
    )]
    pub transfer_hook_config: Account<'info, TransferHookConfig>,
}

#[derive(Accounts)]
pub struct UpsertAllowlistEntry<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        has_one = admin,
        seeds = [constants::SEED_HOOK_CONFIG],
        bump
    )]
    pub transfer_hook_config: Account<'info, TransferHookConfig>,
    /// CHECK: wallet PDA source
    pub wallet: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + HookAllowlistEntry::INIT_SPACE,
        seeds = [constants::SEED_HOOK_ALLOWLIST, wallet.key().as_ref()],
        bump
    )]
    pub allowlist_entry: Account<'info, HookAllowlistEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpsertAssetState<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        has_one = admin,
        seeds = [constants::SEED_HOOK_CONFIG],
        bump
    )]
    pub transfer_hook_config: Account<'info, TransferHookConfig>,
    /// CHECK: asset PDA source
    pub asset: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + HookAssetState::INIT_SPACE,
        seeds = [constants::SEED_HOOK_ASSET_STATE, asset.key().as_ref()],
        bump
    )]
    pub asset_state: Account<'info, HookAssetState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ValidateTransfer<'info> {
    /// CHECK: sender wallet key source
    pub from_wallet: UncheckedAccount<'info>,
    /// CHECK: recipient wallet key source
    pub to_wallet: UncheckedAccount<'info>,
    /// CHECK: asset key source
    pub asset: UncheckedAccount<'info>,
    #[account(
        seeds = [constants::SEED_HOOK_ALLOWLIST, from_wallet.key().as_ref()],
        bump
    )]
    pub from_allowlist: Account<'info, HookAllowlistEntry>,
    #[account(
        seeds = [constants::SEED_HOOK_ALLOWLIST, to_wallet.key().as_ref()],
        bump
    )]
    pub to_allowlist: Account<'info, HookAllowlistEntry>,
    #[account(
        seeds = [constants::SEED_HOOK_ASSET_STATE, asset.key().as_ref()],
        bump
    )]
    pub asset_state: Account<'info, HookAssetState>,
}

#[account]
#[derive(InitSpace)]
pub struct TransferHookConfig {
    pub admin: Pubkey,
    pub receivables_program_id: Pubkey,
    pub transfers_blocked_after_paid: bool,
}

#[account]
#[derive(InitSpace)]
pub struct HookAllowlistEntry {
    pub wallet: Pubkey,
    pub active: bool,
}

#[account]
#[derive(InitSpace)]
pub struct HookAssetState {
    pub asset: Pubkey,
    pub blocked_by_status: bool,
}

#[error_code]
pub enum HookError {
    #[msg("FROM_NOT_ALLOWLISTED")]
    FromNotAllowlisted,
    #[msg("TO_NOT_ALLOWLISTED")]
    ToNotAllowlisted,
    #[msg("ASSET_STATUS_BLOCKED")]
    AssetStatusBlocked,
}
