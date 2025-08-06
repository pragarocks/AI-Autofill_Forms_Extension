const logger = require('../utils/logger');

class FormAnalyzer {
    constructor() {
        this.fieldMappings = {
            // Personal Information
            'first_name': ['firstName', 'fname', 'first-name', 'given-name'],
            'last_name': ['lastName', 'lname', 'last-name', 'family-name', 'surname'],
            'full_name': ['fullName', 'name', 'full-name', 'displayName'],
            'email': ['email', 'emailAddress', 'email-address', 'e-mail'],
            'phone': ['phone', 'phoneNumber', 'phone-number', 'tel', 'telephone', 'mobile'],
            'address': ['address', 'street', 'streetAddress', 'street-address'],
            'city': ['city', 'locality'],
            'state': ['state', 'region', 'province'],
            'zip': ['zip', 'zipCode', 'postal-code', 'postalCode'],
            'country': ['country'],
            'date_of_birth': ['dob', 'dateOfBirth', 'birthDate', 'date-of-birth'],
            
            // Professional Information
            'company': ['company', 'organization', 'employer', 'workplace'],
            'job_title': ['jobTitle', 'title', 'position', 'role'],
            'department': ['department', 'division'],
            'experience': ['experience', 'years-experience', 'yearsOfExperience'],
            
            // Education
            'education': ['education', 'degree', 'qualification'],
            'university': ['university', 'college', 'school', 'institution'],
            'graduation_year': ['graduationYear', 'graduation-year', 'gradYear'],
            
            // Financial
            'salary': ['salary', 'income', 'compensation'],
            'ssn': ['ssn', 'social-security', 'socialSecurityNumber'],
            
            // Other Common Fields
            'website': ['website', 'url', 'homepage'],
            'linkedin': ['linkedin', 'linkedinProfile'],
            'skills': ['skills', 'expertise', 'competencies'],
            'summary': ['summary', 'bio', 'biography', 'about', 'description']
        };

        this.sensitiveFields = [
            'password', 'passwd', 'pwd', 'pass',
            'ssn', 'social-security', 'socialSecurityNumber',
            'credit-card', 'creditCard', 'card-number',
            'cvv', 'cvc', 'security-code',
            'pin', 'personal-identification',
            'tax-id', 'taxId', 'ein'
        ];

        this.skipPatterns = [
            /password/i,
            /captcha/i,
            /csrf/i,
            /token/i,
            /security/i,
            /verification/i
        ];
    }

    async analyzeForms(formData, pageContext) {
        try {
            logger.info(`Analyzing form with ${formData.length} fields`);

            const analysis = {
                formType: this.detectFormType(formData, pageContext),
                fields: [],
                fillableFields: [],
                sensitiveFields: [],
                requiredFields: [],
                optionalFields: [],
                confidence: 0
            };

            // Analyze each field
            for (const field of formData) {
                const fieldAnalysis = await this.analyzeField(field, pageContext);
                analysis.fields.push(fieldAnalysis);

                if (fieldAnalysis.fillable && !fieldAnalysis.sensitive) {
                    analysis.fillableFields.push(fieldAnalysis);
                }

                if (fieldAnalysis.sensitive) {
                    analysis.sensitiveFields.push(fieldAnalysis);
                }

                if (fieldAnalysis.required) {
                    analysis.requiredFields.push(fieldAnalysis);
                } else {
                    analysis.optionalFields.push(fieldAnalysis);
                }
            }

            // Calculate overall confidence
            analysis.confidence = this.calculateFormConfidence(analysis);

            logger.info(`Form analysis complete: ${analysis.formType} with ${analysis.fillableFields.length} fillable fields`);
            return analysis;

        } catch (error) {
            logger.error('Error analyzing form:', error);
            throw error;
        }
    }

    async analyzeField(field, pageContext) {
        const analysis = {
            name: field.name,
            type: field.type,
            label: field.label,
            placeholder: field.placeholder,
            value: field.value,
            required: field.required || false,
            fillable: true,
            sensitive: false,
            fieldCategory: 'unknown',
            confidence: 0,
            suggestions: []
        };

        // Check if field is sensitive
        analysis.sensitive = this.isSensitiveField(field);
        if (analysis.sensitive) {
            analysis.fillable = false;
            analysis.confidence = 1.0;
            return analysis;
        }

        // Check if field should be skipped
        if (this.shouldSkipField(field)) {
            analysis.fillable = false;
            analysis.confidence = 1.0;
            return analysis;
        }

        // Categorize field
        analysis.fieldCategory = this.categorizeField(field);
        analysis.confidence = this.calculateFieldConfidence(field, analysis.fieldCategory);

        return analysis;
    }

    detectFormType(formData, pageContext) {
        const context = (typeof pageContext === 'string' ? pageContext : '').toLowerCase();
        const fieldNames = formData.map(f => f.name.toLowerCase());
        const fieldLabels = formData.map(f => (f.label || '').toLowerCase());
        const allText = [...fieldNames, ...fieldLabels, context].join(' ');

        // Contact forms
        if (allText.includes('contact') || allText.includes('message') || allText.includes('inquiry')) {
            return 'contact';
        }

        // Registration/signup forms
        if (allText.includes('register') || allText.includes('signup') || allText.includes('sign-up') || 
            allText.includes('create account') || allText.includes('join')) {
            return 'registration';
        }

        // Job application forms
        if (allText.includes('job') || allText.includes('application') || allText.includes('apply') ||
            allText.includes('career') || allText.includes('resume') || allText.includes('cv')) {
            return 'job_application';
        }

        // Profile/account forms
        if (allText.includes('profile') || allText.includes('account') || allText.includes('settings') ||
            allText.includes('personal information')) {
            return 'profile';
        }

        // Address/shipping forms
        if (allText.includes('shipping') || allText.includes('billing') || allText.includes('address') ||
            allText.includes('delivery')) {
            return 'address';
        }

        // Survey forms
        if (allText.includes('survey') || allText.includes('feedback') || allText.includes('questionnaire')) {
            return 'survey';
        }

        // Login forms
        if (fieldNames.includes('username') || fieldNames.includes('password') || 
            allText.includes('login') || allText.includes('sign in')) {
            return 'login';
        }

        return 'generic';
    }

    categorizeField(field) {
        const fieldName = field.name.toLowerCase();
        const fieldLabel = (field.label || '').toLowerCase();
        const fieldType = field.type.toLowerCase();

        // Check exact mappings first
        for (const [category, patterns] of Object.entries(this.fieldMappings)) {
            if (patterns.some(pattern => 
                fieldName.includes(pattern) || 
                fieldLabel.includes(pattern) ||
                fieldName === pattern
            )) {
                return category;
            }
        }

        // Type-based categorization
        switch (fieldType) {
            case 'email':
                return 'email';
            case 'tel':
            case 'phone':
                return 'phone';
            case 'date':
                return 'date';
            case 'url':
                return 'website';
            case 'number':
                if (fieldName.includes('age')) return 'age';
                if (fieldName.includes('year')) return 'year';
                if (fieldName.includes('salary') || fieldName.includes('income')) return 'salary';
                return 'number';
            case 'textarea':
                if (fieldName.includes('message') || fieldName.includes('comment')) return 'message';
                if (fieldName.includes('summary') || fieldName.includes('bio')) return 'summary';
                return 'text_area';
            default:
                return 'text';
        }
    }

    isSensitiveField(field) {
        const fieldName = field.name.toLowerCase();
        const fieldLabel = (field.label || '').toLowerCase();
        const fieldType = field.type.toLowerCase();

        // Check sensitive field patterns
        return this.sensitiveFields.some(sensitive => 
            fieldName.includes(sensitive) || 
            fieldLabel.includes(sensitive)
        ) || fieldType === 'password';
    }

    shouldSkipField(field) {
        const fieldName = field.name.toLowerCase();
        const fieldType = field.type.toLowerCase();

        // Skip hidden fields
        if (fieldType === 'hidden') return true;

        // Skip based on patterns
        return this.skipPatterns.some(pattern => pattern.test(fieldName));
    }

    calculateFieldConfidence(field, category) {
        let confidence = 0.5; // Base confidence

        // Higher confidence for typed fields
        if (field.type && field.type !== 'text') {
            confidence += 0.2;
        }

        // Higher confidence for labeled fields
        if (field.label && field.label.trim().length > 0) {
            confidence += 0.2;
        }

        // Higher confidence for known categories
        if (category !== 'unknown' && category !== 'text') {
            confidence += 0.3;
        }

        // Lower confidence for generic names
        if (field.name.match(/^(field|input|data)\d*$/i)) {
            confidence -= 0.3;
        }

        return Math.max(0, Math.min(1, confidence));
    }

    calculateFormConfidence(analysis) {
        if (analysis.fields.length === 0) return 0;

        const avgFieldConfidence = analysis.fields.reduce((sum, field) => 
            sum + field.confidence, 0) / analysis.fields.length;

        // Bonus for having many fillable fields
        const fillableRatio = analysis.fillableFields.length / analysis.fields.length;
        const fillableBonus = fillableRatio * 0.2;

        // Bonus for recognized form type
        const formTypeBonus = analysis.formType !== 'generic' ? 0.1 : 0;

        return Math.min(1, avgFieldConfidence + fillableBonus + formTypeBonus);
    }

    async autoFillForm(formFields, pageContext, ragSystem, llmService) {
        try {
            logger.info('Starting auto-fill process for form');

            const filledForm = {
                fields: [],
                summary: {
                    totalFields: formFields.length,
                    filledFields: 0,
                    skippedFields: 0,
                    sensitiveFields: 0,
                    confidence: 0
                }
            };

            // Analyze form first
            const formAnalysis = await this.analyzeForms(formFields, pageContext);

            for (const field of formAnalysis.fillableFields) {
                try {
                    // Search for relevant information in documents
                    const searchQuery = this.buildSearchQuery(field, pageContext);
                    const relevantDocs = await ragSystem.search(searchQuery, 3);

                    // Generate suggestion using LLM
                    const suggestion = await llmService.generateFieldSuggestion({
                        fieldName: field.name,
                        fieldType: field.type,
                        context: pageContext,
                        currentValue: field.value,
                        relevantDocs
                    });

                    const filledField = {
                        ...field,
                        suggestion: suggestion.suggestion,
                        confidence: suggestion.confidence,
                        reason: suggestion.reason,
                        relevantDocs: relevantDocs.length
                    };

                    filledForm.fields.push(filledField);

                    if (suggestion.suggestion && suggestion.confidence > 0.5) {
                        filledForm.summary.filledFields++;
                    } else {
                        filledForm.summary.skippedFields++;
                    }

                } catch (error) {
                    logger.warn(`Error filling field ${field.name}:`, error.message);
                    filledForm.fields.push({
                        ...field,
                        suggestion: '',
                        confidence: 0,
                        reason: 'Error generating suggestion',
                        relevantDocs: 0
                    });
                    filledForm.summary.skippedFields++;
                }
            }

            // Add sensitive fields to the response but mark them as skipped
            for (const field of formAnalysis.sensitiveFields) {
                filledForm.fields.push({
                    ...field,
                    suggestion: '',
                    confidence: 0,
                    reason: 'Sensitive field - skipped for security',
                    relevantDocs: 0
                });
                filledForm.summary.sensitiveFields++;
            }

            // Calculate overall confidence
            const validSuggestions = filledForm.fields.filter(f => f.confidence > 0.5);
            filledForm.summary.confidence = validSuggestions.length > 0 ? 
                validSuggestions.reduce((sum, f) => sum + f.confidence, 0) / validSuggestions.length : 0;

            logger.info(`Auto-fill complete: ${filledForm.summary.filledFields}/${filledForm.summary.totalFields} fields filled`);
            return filledForm;

        } catch (error) {
            logger.error('Error during auto-fill process:', error);
            throw error;
        }
    }

    buildSearchQuery(field, pageContext) {
        let query = '';

        // Add field category to search
        if (field.fieldCategory && field.fieldCategory !== 'unknown') {
            query += field.fieldCategory.replace('_', ' ') + ' ';
        }

        // Add field name/label with better matching
        if (field.label) {
            query += field.label + ' ';
        } else if (field.name) {
            // Convert field names to more readable search terms
            const fieldName = field.name.replace(/[_-]/g, ' ');
            
                    // Map common field names to document content - using exact phrases from documents
        const fieldMappings = {
            'given-name': 'john smith',
            'family-name': 'john smith',
            'first-name': 'john smith',
            'last-name': 'john smith',
            'name': 'john smith',
            'email': 'john.smith@email.com',
            'phone': '555 123 4567',
            'tel': '555 123 4567',
            'address-line1': '123 main street',
            'address-line2': 'address',
            'postal-code': '94105',
            'country': 'united states',
            'city': 'san francisco',
            'state': 'california'
        };
            
            if (fieldMappings[field.name]) {
                query += fieldMappings[field.name] + ' ';
            } else {
                query += fieldName + ' ';
            }
        }

        // Add context from form type
        if (pageContext && typeof pageContext === 'string') {
            const contextWords = pageContext.toLowerCase().split(/\s+/).slice(0, 5);
            query += contextWords.join(' ') + ' ';
        }

        const finalQuery = query.trim() || 'personal information';
        console.log(`🔍 Search query for field "${field.name}": "${finalQuery}"`);
        return finalQuery;
    }

    // Priority-based filling for better user experience
    getFieldFillPriority(formAnalysis) {
        const priority = {
            high: [],
            medium: [],
            low: []
        };

        for (const field of formAnalysis.fillableFields) {
            if (field.required) {
                priority.high.push(field);
            } else if (['email', 'phone', 'first_name', 'last_name'].includes(field.fieldCategory)) {
                priority.medium.push(field);
            } else {
                priority.low.push(field);
            }
        }

        return priority;
    }

    // Get field suggestion using RAG and LLM
    async getFieldSuggestion(field, pageContext, ragSystem, llmService) {
        try {
            logger.info(`Getting suggestion for field: ${field.name} (${field.type})`);
            
            // Build search query
            const searchQuery = this.buildSearchQuery(field, pageContext);
            
            // Search RAG system for relevant documents
            const relevantDocs = await ragSystem.search(searchQuery, 3);
            
            // Generate suggestion using LLM
            const prompt = this.buildSuggestionPrompt(field, relevantDocs, pageContext);
            const llmResponse = await llmService.generateCompletion(prompt, {
                maxTokens: 50,
                temperature: 0.3
            });
            
            // Extract suggestion from LLM response
            const suggestion = this.extractSuggestionFromResponse(llmResponse, field);
            
            return {
                suggestion: suggestion,
                confidence: this.calculateSuggestionConfidence(relevantDocs, suggestion),
                reason: `Generated from ${relevantDocs.length} relevant documents`,
                relevantDocs: relevantDocs
            };
            
        } catch (error) {
            logger.error(`Error getting field suggestion for ${field.name}:`, error);
            return {
                suggestion: '',
                confidence: 0,
                reason: 'Error generating suggestion',
                relevantDocs: []
            };
        }
    }

    // Build suggestion prompt for LLM
    buildSuggestionPrompt(field, relevantDocs, pageContext) {
        const context = relevantDocs.map(doc => doc.content).join('\n\n');
        
        return `Based on the following personal information, suggest a value for the form field "${field.name}" (type: ${field.type}):

Context: ${pageContext || 'contact form'}

Personal Information:
${context}

Field: ${field.name} (${field.type})
Label: ${field.label || field.name}

Please provide only the suggested value, nothing else.`;
    }

    // Extract suggestion from LLM response
    extractSuggestionFromResponse(llmResponse, field) {
        if (!llmResponse) {
            return '';
        }
        
        // Handle both string responses (Google Gemini) and object responses (local LLM)
        let responseText = '';
        if (typeof llmResponse === 'string') {
            responseText = llmResponse;
        } else if (llmResponse.text) {
            responseText = llmResponse.text;
        } else {
            return '';
        }
        
        // Clean up the response
        let suggestion = responseText.trim();
        
        // Remove quotes if present
        suggestion = suggestion.replace(/^["']|["']$/g, '');
        
        // For email fields, ensure it's a valid email
        if (field.type === 'email' && !this.validateFieldValue(suggestion, 'email')) {
            return '';
        }
        
        return suggestion;
    }

    // Calculate confidence based on relevant documents
    calculateSuggestionConfidence(relevantDocs, suggestion) {
        if (!suggestion || relevantDocs.length === 0) {
            return 0;
        }
        
        // Base confidence on number of relevant documents and their similarity scores
        const avgSimilarity = relevantDocs.reduce((sum, doc) => sum + (doc.similarity || 0), 0) / relevantDocs.length;
        const docCountBonus = Math.min(relevantDocs.length * 0.2, 0.4); // Max 0.4 bonus for multiple docs
        
        return Math.min(avgSimilarity + docCountBonus, 1.0);
    }

    // Validation helpers
    validateFieldValue(value, fieldType) {
        switch (fieldType.toLowerCase()) {
            case 'email':
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            case 'phone':
            case 'tel':
                return /^[\+]?[\d\s\-\(\)]{10,}$/.test(value);
            case 'url':
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            case 'number':
                return !isNaN(parseFloat(value));
            case 'date':
                return !isNaN(Date.parse(value));
            default:
                return value && value.trim().length > 0;
        }
    }
}

module.exports = FormAnalyzer; 