// Import necessary functions and types from Solana web3.js library
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
// Import hooks from Solana wallet adapter for React
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react'; // Import useState for managing input values
// Import constants and functions from SPL Token library, specifically for Token-2022 program
import { 
    TOKEN_2022_PROGRAM_ID,  // Program ID for Token-2022
    getMintLen,             // Function to calculate mint account length
    createInitializeMetadataPointerInstruction,  // Instruction to initialize metadata pointer
    createInitializeMintInstruction,  // Instruction to initialize mint
    TYPE_SIZE,              // Constants for metadata size calculation
    LENGTH_SIZE,
    ExtensionType           // Enum of token extension types
} from "@solana/spl-token"
// Import functions for token metadata from SPL Token Metadata library
import { createInitializeInstruction, pack } from '@solana/spl-token-metadata';

// Define the main component
export function TokenLaunchpad() {
    // Use the useConnection hook to get the Solana connection object
    const { connection } = useConnection();
    // Use the useWallet hook to get the wallet object
    const wallet = useWallet();
    // State variables to hold input values for token creation
    const [name, setName] = useState('');          // State for token name
    const [symbol, setSymbol] = useState('');      // State for token symbol
    const [uri, setUri] = useState('');            // State for token metadata URI
    const [initialSupply, setInitialSupply] = useState(''); // State for initial token supply


    // Define the asynchronous function to create a token
    async function createToken() {
        // Generate a new keypair for the mint account
        const mintKeypair = Keypair.generate();

        // Define the metadata for the token (currently hardcoded)
        const metadata = {
            mint: mintKeypair.publicKey,  // Public key of the mint account
            name: name || 'FR',                 // Name of the token
            symbol: symbol || 'FR',            // Symbol of the token (padded to 10 characters)
            uri: uri ||'https://cdn.100xdevs.com/metadata.json',  // URI for additional metadata
            additionalMetadata: [],       // Additional metadata (empty in this case)
        };

        // Calculate the length of the mint account, including the MetadataPointer extension
        const mintLen = getMintLen([ExtensionType.MetadataPointer]);
        // Calculate the length of the metadata
        const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

        // Get the minimum balance required for rent exemption for both mint and metadata accounts
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

        // Create a new transaction
        const transaction = new Transaction().add(
            // Instruction to create the mint account
            SystemProgram.createAccount({
                fromPubkey: wallet.publicKey,  // The payer (current wallet)
                newAccountPubkey: mintKeypair.publicKey,  // Public key of the new mint account
                space: mintLen,  // Space required for the mint account
                lamports,  // Lamports to fund the account
                programId: TOKEN_2022_PROGRAM_ID,  // The Token-2022 program ID
            }),
            // Instruction to initialize the metadata pointer
            createInitializeMetadataPointerInstruction(
                mintKeypair.publicKey,  // The mint account
                wallet.publicKey,       // The update authority (current wallet)
                mintKeypair.publicKey,  // The metadata address (same as mint in this case)
                TOKEN_2022_PROGRAM_ID   // The Token-2022 program ID
            ),
            // Instruction to initialize the mint
            createInitializeMintInstruction(
                mintKeypair.publicKey,  // The mint account
                9,                      // Decimals for the token
                wallet.publicKey,       // Mint authority (current wallet)
                null,                   // Freeze authority (null in this case)
                TOKEN_2022_PROGRAM_ID   // The Token-2022 program ID
            ),
            // Instruction to initialize the metadata
            createInitializeInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                mint: mintKeypair.publicKey,
                metadata: mintKeypair.publicKey,
                name: metadata.name,
                symbol: metadata.symbol,
                uri: metadata.uri,
                mintAuthority: wallet.publicKey,
                updateAuthority: wallet.publicKey,
            }),
        );
            
    // Set the fee payer for the transaction
    transaction.feePayer = wallet.publicKey;
        // Get and set the recent blockhash for the transaction
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        // Partially sign the transaction with the mint keypair
        transaction.partialSign(mintKeypair);
    
        // Send the transaction using the wallet adapter
        await wallet.sendTransaction(transaction, connection);
    // Log the public key of the created token mint
    console.log(`Token mint created at ${mintKeypair.publicKey.toBase58()}`);

    // Derive the associated token account address for the mint and the user's wallet
    const associatedToken = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,  // Public key of the token mint
        wallet.publicKey,       // Public key of the user's wallet
        false,                  // If true, derives the associated token account for a PDA (Program Derived Address)
        TOKEN_2022_PROGRAM_ID   // The token program ID to use (for example, the SPL Token 2022 program)
    );

    // Log the derived associated token account address
    console.log(associatedToken.toBase58());

    // Create a new transaction for creating the associated token account
    const transaction2 = new Transaction().add(
        createAssociatedTokenAccountInstruction(
            wallet.publicKey,       // Funding account (payer)
            associatedToken,        // Associated token account to be created
            wallet.publicKey,       // Owner of the associated token account
            mintKeypair.publicKey,  // Public key of the token mint
            TOKEN_2022_PROGRAM_ID   // The token program ID
        ),
    );

    // Send the transaction to the network to create the associated token account
    await wallet.sendTransaction(transaction2, connection);

    // Create a new transaction for minting tokens to the associated token account
    const transaction3 = new Transaction().add(
        createMintToInstruction(
            mintKeypair.publicKey,  // Public key of the token mint
            associatedToken,        // Associated token account to receive the minted tokens
            wallet.publicKey,       // Authority to mint the tokens
            parseInt(initialSupply) || 1000000000,             // Amount of tokens to mint (in smallest units, like Lamports for SOL), Amount of tokens to mint (use default if empty)
            [],                     // Array of signers for the minting (if any)
            TOKEN_2022_PROGRAM_ID   // The token program ID
        )
    );

    // Send the transaction to the network to mint the tokens
    await wallet.sendTransaction(transaction3, connection);

    // Log confirmation that the minting process is complete
    console.log("Minted!");

    }

    // Render the component
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
        }}>
            <h1>Solana Token Launchpad</h1>
            {/* Input fields for token details (currently not connected to createToken function) */}
            <input 
    className='inputText' 
    type='text' 
    placeholder='Name' 
    value={name} // Bind input value to the name state variable
    onChange={(e) => setName(e.target.value)} // Update state on user input
/> <br />

<input 
    className='inputText' 
    type='text' 
    placeholder='Symbol' 
    value={symbol} // Bind input value to the symbol state variable
    onChange={(e) => setSymbol(e.target.value)} // Update state on user input
/> <br />

<input 
    className='inputText' 
    type='text' 
    placeholder='Image URL' 
    value={uri} // Bind input value to the uri state variable
    onChange={(e) => setUri(e.target.value)} // Update state on user input
/> <br />

<input 
    className='inputText' 
    type='text' 
    placeholder='Initial Supply' 
    value={initialSupply} // Bind input value to the initialSupply state variable
    onChange={(e) => setInitialSupply(e.target.value)} // Update state on user input
/> <br />

            {/* Button to trigger token creation */}
            <button onClick={createToken} className='btn'>Create a token</button>
        </div>
    );
}