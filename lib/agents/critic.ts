// lib/agents/critic.ts
// Critic Agent - Validates and reviews cell outputs before showing to user

import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

export interface CriticReview {
    approved: boolean;
    confidence: number;  // 0-100
    issues: string[];
    suggestions: string[];
    correctedOutput?: any;
    reasoning: string;
}

interface CriticOptions {
    cellType: string;
    originalPrompt: string;
    output: any;
    context?: string;
    strictMode?: boolean;  // More rigorous checking
}

/**
 * Critic Agent - Reviews cell outputs for quality, accuracy, and safety
 */
export async function reviewOutput(options: CriticOptions): Promise<CriticReview> {
    const { cellType, originalPrompt, output, context, strictMode = false } = options;

    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);

    const systemPrompt = `You are a Critic Agent responsible for reviewing AI-generated outputs before they are shown to users.

Your job is to evaluate the output for:
1. **Accuracy**: Does the output correctly address the user's request?
2. **Completeness**: Is anything missing that was explicitly requested?
3. **Quality**: Is the output well-structured and professional?
4. **Safety**: Does it contain any harmful, biased, or inappropriate content?
5. **Factual Correctness**: Are any claims verifiable and reasonable?

Cell Type: ${cellType}
${strictMode ? 'MODE: STRICT - Apply rigorous standards' : 'MODE: STANDARD'}

You must respond in valid JSON format:
{
    "approved": boolean,
    "confidence": number (0-100),
    "issues": ["issue1", "issue2"],
    "suggestions": ["suggestion1", "suggestion2"],
    "correctedOutput": null or corrected version,
    "reasoning": "Brief explanation of your review"
}

If approved is true, issues should be empty or contain only minor observations.
If approved is false, provide specific actionable feedback.
Only provide correctedOutput if you can actually fix the issue.`;

    const userPrompt = `Review this AI output:

**Original User Request:**
${originalPrompt}

**AI Output:**
${outputStr}

${context ? `**Additional Context:**\n${context}` : ''}

Evaluate and respond with your JSON review.`;

    try {
        const response = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            system: systemPrompt,
            prompt: userPrompt,
        });

        // Parse the JSON response
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const review = JSON.parse(jsonMatch[0]) as CriticReview;
            return review;
        }

        // Fallback if parsing fails - approve with note
        return {
            approved: true,
            confidence: 70,
            issues: [],
            suggestions: ['Critic response parsing failed - manual review recommended'],
            reasoning: 'Unable to parse critic response, defaulting to approval',
        };

    } catch (error: any) {
        console.error('[Critic] Review failed:', error);
        
        // On error, approve but flag for attention
        return {
            approved: true,
            confidence: 50,
            issues: [],
            suggestions: ['Critic agent encountered an error - manual review recommended'],
            reasoning: `Critic error: ${error.message}`,
        };
    }
}

/**
 * Quick validation for specific output types
 */
export async function validateDataOutput(data: any): Promise<{
    valid: boolean;
    errors: string[];
}> {
    const errors: string[] = [];

    // Check if data exists
    if (data === null || data === undefined) {
        errors.push('Output is null or undefined');
        return { valid: false, errors };
    }

    // Check for empty arrays/objects
    if (Array.isArray(data) && data.length === 0) {
        errors.push('Output array is empty');
    }

    if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) {
        errors.push('Output object is empty');
    }

    // Check for error indicators in the data
    if (typeof data === 'object') {
        if (data.error || data.Error || data.ERROR) {
            errors.push(`Output contains error: ${data.error || data.Error || data.ERROR}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Check if output matches expected type
 */
export function validateOutputType(output: any, expectedType: string): boolean {
    switch (expectedType) {
        case 'json':
            return typeof output === 'object';
        case 'text':
            return typeof output === 'string';
        case 'table':
            return Array.isArray(output) || (typeof output === 'object' && output.rows);
        case 'chart':
            return typeof output === 'object' && (output.chartType || output.labels);
        default:
            return true;
    }
}

/**
 * Severity levels for issues
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

export function categorizeIssue(issue: string): IssueSeverity {
    const criticalKeywords = ['error', 'fail', 'invalid', 'missing required', 'null', 'undefined'];
    const warningKeywords = ['incomplete', 'partial', 'approximate', 'estimated'];
    
    const lowerIssue = issue.toLowerCase();
    
    if (criticalKeywords.some(k => lowerIssue.includes(k))) {
        return 'critical';
    }
    if (warningKeywords.some(k => lowerIssue.includes(k))) {
        return 'warning';
    }
    return 'info';
}
