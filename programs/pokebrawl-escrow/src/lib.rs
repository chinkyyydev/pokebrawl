use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("5eXLrUexRtKcpJPP6jf6dntKZoueq6F9SzkycBdGxWCq");

#[program]
pub mod pokebrawl_escrow {
    use super::*;

    /// Player 1 opens a match and deposits their stake into the match PDA.
    /// `authority` is the game server's pubkey — the only key allowed to settle.
    pub fn create_match(
        ctx: Context<CreateMatch>,
        match_id: u64,
        stake: u64,
        authority: Pubkey,
    ) -> Result<()> {
        require!(stake > 0, EscrowError::InvalidStake);

        // Move player 1's stake into the match account (a program-owned PDA).
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.match_account.to_account_info(),
                },
            ),
            stake,
        )?;

        let m = &mut ctx.accounts.match_account;
        m.match_id = match_id;
        m.stake = stake;
        m.authority = authority;
        m.player1 = ctx.accounts.player.key();
        m.player2 = Pubkey::default();
        m.settled = false;
        m.bump = ctx.bumps.match_account;
        Ok(())
    }

    /// Player 2 joins and deposits the matching stake.
    pub fn join_match(ctx: Context<JoinMatch>) -> Result<()> {
        let (stake, player1) = {
            let m = &ctx.accounts.match_account;
            require!(!m.settled, EscrowError::AlreadySettled);
            require!(m.player2 == Pubkey::default(), EscrowError::AlreadyFull);
            (m.stake, m.player1)
        };
        require_keys_neq!(ctx.accounts.player.key(), player1, EscrowError::CannotPlaySelf);

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.match_account.to_account_info(),
                },
            ),
            stake,
        )?;

        ctx.accounts.match_account.player2 = ctx.accounts.player.key();
        Ok(())
    }

    /// The trusted authority (game server) pays the whole pot to the winner.
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        let m = &mut ctx.accounts.match_account;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            m.authority,
            EscrowError::Unauthorized
        );
        require!(!m.settled, EscrowError::AlreadySettled);
        require!(m.player2 != Pubkey::default(), EscrowError::NotFunded);

        let winner = ctx.accounts.winner.key();
        require!(
            winner == m.player1 || winner == m.player2,
            EscrowError::InvalidWinner
        );

        let pot = m.stake.checked_mul(2).ok_or(EscrowError::Overflow)?;
        **m.to_account_info().try_borrow_mut_lamports()? -= pot;
        **ctx.accounts.winner.to_account_info().try_borrow_mut_lamports()? += pot;
        m.settled = true;
        Ok(())
    }

    /// Authority refunds both players (e.g. a draw or aborted match).
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let m = &mut ctx.accounts.match_account;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            m.authority,
            EscrowError::Unauthorized
        );
        require!(!m.settled, EscrowError::AlreadySettled);
        require!(m.player2 != Pubkey::default(), EscrowError::NotFunded);
        require_keys_eq!(ctx.accounts.player1.key(), m.player1, EscrowError::InvalidWinner);
        require_keys_eq!(ctx.accounts.player2.key(), m.player2, EscrowError::InvalidWinner);

        let stake = m.stake;
        **m.to_account_info().try_borrow_mut_lamports()? -= stake;
        **ctx.accounts.player1.to_account_info().try_borrow_mut_lamports()? += stake;
        **m.to_account_info().try_borrow_mut_lamports()? -= stake;
        **ctx.accounts.player2.to_account_info().try_borrow_mut_lamports()? += stake;
        m.settled = true;
        Ok(())
    }

    /// Cancel a match nobody joined; refunds player 1. Callable by authority or player 1.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let m = &mut ctx.accounts.match_account;
        require!(!m.settled, EscrowError::AlreadySettled);
        require!(m.player2 == Pubkey::default(), EscrowError::AlreadyFull);
        let signer = ctx.accounts.signer.key();
        require!(
            signer == m.authority || signer == m.player1,
            EscrowError::Unauthorized
        );
        require_keys_eq!(ctx.accounts.player1.key(), m.player1, EscrowError::InvalidWinner);

        let stake = m.stake;
        **m.to_account_info().try_borrow_mut_lamports()? -= stake;
        **ctx.accounts.player1.to_account_info().try_borrow_mut_lamports()? += stake;
        m.settled = true;
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Match {
    pub match_id: u64,
    pub stake: u64,      // lamports each player stakes
    pub authority: Pubkey,
    pub player1: Pubkey,
    pub player2: Pubkey, // default pubkey until someone joins
    pub settled: bool,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct CreateMatch<'info> {
    #[account(
        init,
        payer = player,
        space = 8 + Match::INIT_SPACE,
        seeds = [b"match", match_id.to_le_bytes().as_ref()],
        bump
    )]
    pub match_account: Account<'info, Match>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinMatch<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.to_le_bytes().as_ref()],
        bump = match_account.bump
    )]
    pub match_account: Account<'info, Match>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.to_le_bytes().as_ref()],
        bump = match_account.bump
    )]
    pub match_account: Account<'info, Match>,
    pub authority: Signer<'info>,
    /// CHECK: validated against match_account.player1/player2 in the handler.
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.to_le_bytes().as_ref()],
        bump = match_account.bump
    )]
    pub match_account: Account<'info, Match>,
    pub authority: Signer<'info>,
    /// CHECK: validated == match_account.player1.
    #[account(mut)]
    pub player1: UncheckedAccount<'info>,
    /// CHECK: validated == match_account.player2.
    #[account(mut)]
    pub player2: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.to_le_bytes().as_ref()],
        bump = match_account.bump
    )]
    pub match_account: Account<'info, Match>,
    pub signer: Signer<'info>,
    /// CHECK: validated == match_account.player1.
    #[account(mut)]
    pub player1: UncheckedAccount<'info>,
}

#[error_code]
pub enum EscrowError {
    #[msg("Stake must be greater than zero")]
    InvalidStake,
    #[msg("Match already settled")]
    AlreadySettled,
    #[msg("Match already has two players")]
    AlreadyFull,
    #[msg("You cannot play against yourself")]
    CannotPlaySelf,
    #[msg("Only the match authority may do this")]
    Unauthorized,
    #[msg("Both players must be funded")]
    NotFunded,
    #[msg("Account must be one of the match players")]
    InvalidWinner,
    #[msg("Arithmetic overflow")]
    Overflow,
}
