import React from 'react';
import VariableAutocomplete from '../../VariableAutocomplete.jsx';
import ErrorConfig from './ErrorConfig.jsx';

/**
 * HubSpot CRM Node Configuration
 * Simplified configuration for MVP: Create Contact, Update Contact, Get Contact, Add to List
 */
export default function HubspotConfig({
  localData,
  handleUpdate,
  availableVariables,
  hubspot,
}) {
  const actionType = localData.actionType || 'create-contact';

  // Fetch lists when action type is 'add-to-list' and connected
  React.useEffect(() => {
    if (
      actionType === 'add-to-list' &&
      hubspot?.status?.connected &&
      hubspot.lists.length === 0
    ) {
      hubspot.fetchLists();
    }
  }, [actionType, hubspot?.status?.connected]);

  // Fetch contacts when action type is 'get-contact' or 'update-contact' and connected
  React.useEffect(() => {
    if (
      (actionType === 'get-contact' || actionType === 'update-contact') &&
      hubspot?.status?.connected &&
      hubspot.contacts.length === 0
    ) {
      hubspot.fetchContacts(100);
    }
  }, [actionType, hubspot?.status?.connected]);

  // Fetch companies when action type is 'get-company' or 'update-company' and connected
  React.useEffect(() => {
    if (
      (actionType === 'get-company' || actionType === 'update-company') &&
      hubspot?.status?.connected &&
      hubspot.companies.length === 0
    ) {
      hubspot.fetchCompanies(100);
    }
  }, [actionType, hubspot?.status?.connected]);

  return (
    <>
      {/* Action Type Dropdown */}
      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
          }}
        >
          Action
        </label>
        <select
          value={actionType}
          onChange={e => {
            handleUpdate('actionType', e.target.value);
            // Clear fields when action type changes
            handleUpdate('firstName', '');
            handleUpdate('lastName', '');
            handleUpdate('email', '');
            handleUpdate('phone', '');
            handleUpdate('company', '');
            handleUpdate('contactEmail', '');
            handleUpdate('listId', '');
          }}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '0.875rem',
            background: '#2a2a2a',
            color: 'hsl(var(--foreground))',
          }}
        >
          <option value="create-contact">Create Contact</option>
          <option value="update-contact">Update Contact</option>
          <option value="get-contact">Get Contact</option>
          <option value="add-to-list">Add Contact to List</option>
          <option value="create-company">Create Company</option>
          <option value="update-company">Update Company</option>
          <option value="get-company">Get Company</option>
        </select>
      </div>

      {/* Create/Update Contact Fields */}
      {(actionType === 'create-contact' || actionType === 'update-contact') && (
        <>
          {actionType === 'update-contact' && (
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                }}
              >
                Contact *
              </label>
              {hubspot?.status?.connected && hubspot.contacts.length > 0 ? (
                <>
                  <select
                    value={localData.contactEmail || localData.contactId || ''}
                    onChange={e => {
                      const selectedContact = hubspot.contacts.find(
                        c =>
                          c.email === e.target.value || c.id === e.target.value
                      );
                      if (selectedContact) {
                        handleUpdate('contactEmail', selectedContact.email);
                        handleUpdate('contactId', selectedContact.id);
                        handleUpdate('email', selectedContact.email);
                        // Pre-fill fields if contact is selected
                        handleUpdate('firstName', selectedContact.firstName || '');
                        handleUpdate('lastName', selectedContact.lastName || '');
                        handleUpdate('phone', selectedContact.phone || '');
                        handleUpdate('company', selectedContact.company || '');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      background: '#2a2a2a',
                      color: 'hsl(var(--foreground))',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <option value="">Select a contact to update...</option>
                    {hubspot.contacts.map(contact => (
                      <option key={contact.id} value={contact.email}>
                        {contact.displayName} ({contact.email})
                      </option>
                    ))}
                  </select>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      marginTop: '0.25rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Or enter email manually below
                  </div>
                </>
              ) : hubspot?.status?.connected ? (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    marginBottom: '0.5rem',
                  }}
                >
                  Loading contacts...
                </div>
              ) : null}
            </div>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              First Name
            </label>
            <VariableAutocomplete
              value={localData.firstName || ''}
              onChange={e => handleUpdate('firstName', e.target.value)}
              availableVariables={availableVariables}
              placeholder="John or {{previous.output.firstName}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Last Name
            </label>
            <VariableAutocomplete
              value={localData.lastName || ''}
              onChange={e => handleUpdate('lastName', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Doe or {{previous.output.lastName}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Email *
            </label>
            <VariableAutocomplete
              value={localData.email || ''}
              onChange={e => handleUpdate('email', e.target.value)}
              availableVariables={availableVariables}
              placeholder="john@example.com or {{previous.output.email}}"
            />
            <div
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginTop: '0.25rem',
              }}
            >
              Required for creating/updating contacts
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Phone
            </label>
            <VariableAutocomplete
              value={localData.phone || ''}
              onChange={e => handleUpdate('phone', e.target.value)}
              availableVariables={availableVariables}
              placeholder="+1234567890 or {{previous.output.phone}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Company
            </label>
            <VariableAutocomplete
              value={localData.company || ''}
              onChange={e => handleUpdate('company', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Acme Inc or {{previous.output.company}}"
            />
          </div>
        </>
      )}

      {/* Get Contact Fields */}
      {actionType === 'get-contact' && (
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
            }}
          >
            Contact *
          </label>
          {hubspot?.status?.connected && hubspot.contacts.length > 0 ? (
            <>
              <select
                value={localData.contactEmail || localData.contactId || ''}
                onChange={e => {
                  const selectedContact = hubspot.contacts.find(
                    c => c.email === e.target.value || c.id === e.target.value
                  );
                  if (selectedContact) {
                    handleUpdate('contactEmail', selectedContact.email);
                    handleUpdate('contactId', selectedContact.id);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'hsl(var(--foreground))',
                  marginBottom: '0.5rem',
                }}
              >
                <option value="">Select a contact...</option>
                {hubspot.contacts.map(contact => (
                  <option key={contact.id} value={contact.email}>
                    {contact.displayName} ({contact.email})
                  </option>
                ))}
              </select>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  marginTop: '0.25rem',
                }}
              >
                Or enter email manually below
              </div>
            </>
          ) : null}
          <VariableAutocomplete
            value={localData.contactEmail || ''}
            onChange={e => handleUpdate('contactEmail', e.target.value)}
            availableVariables={availableVariables}
            placeholder="john@example.com or {{previous.output.email}}"
          />
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginTop: '0.25rem',
            }}
          >
            Search for contact by email address
          </div>
        </div>
      )}

      {/* Add to List Fields */}
      {actionType === 'add-to-list' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Contact Email *
            </label>
            <VariableAutocomplete
              value={localData.contactEmail || ''}
              onChange={e => handleUpdate('contactEmail', e.target.value)}
              availableVariables={availableVariables}
              placeholder="john@example.com or {{previous.output.email}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              List
            </label>
            <select
              value={localData.listId || ''}
              onChange={e => handleUpdate('listId', e.target.value)}
              disabled={!hubspot?.status?.connected || hubspot.loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: '#2a2a2a',
                color: 'hsl(var(--foreground))',
                opacity: !hubspot?.status?.connected ? 0.5 : 1,
                cursor: !hubspot?.status?.connected ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="">
                {!hubspot?.status?.connected
                  ? 'Connect HubSpot first'
                  : hubspot.loading
                    ? 'Loading lists...'
                    : hubspot.lists.length === 0
                      ? 'No lists found'
                      : 'Select a list...'}
              </option>
              {hubspot?.lists?.map(list => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginTop: '0.25rem',
              }}
            >
              Select a list to add the contact to
            </div>
          </div>
        </>
      )}

      {/* Create Company Fields */}
      {actionType === 'create-company' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Company Name *
            </label>
            <VariableAutocomplete
              value={localData.name || ''}
              onChange={e => handleUpdate('name', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Acme Inc or {{previous.output.companyName}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Domain
            </label>
            <VariableAutocomplete
              value={localData.domain || ''}
              onChange={e => handleUpdate('domain', e.target.value)}
              availableVariables={availableVariables}
              placeholder="acme.com or {{previous.output.domain}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Phone
            </label>
            <VariableAutocomplete
              value={localData.phone || ''}
              onChange={e => handleUpdate('phone', e.target.value)}
              availableVariables={availableVariables}
              placeholder="+1234567890 or {{previous.output.phone}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              City
            </label>
            <VariableAutocomplete
              value={localData.city || ''}
              onChange={e => handleUpdate('city', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Berlin or {{previous.output.city}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Country
            </label>
            <VariableAutocomplete
              value={localData.country || ''}
              onChange={e => handleUpdate('country', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Germany or {{previous.output.country}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Industry
            </label>
            <VariableAutocomplete
              value={localData.industry || ''}
              onChange={e => handleUpdate('industry', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Technology or {{previous.output.industry}}"
            />
          </div>
        </>
      )}

      {/* Update Company Fields */}
      {actionType === 'update-company' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Company to Update *
            </label>
            {hubspot?.status?.connected && hubspot.companies.length > 0 ? (
              <>
                <select
                  value={localData.companyId || ''}
                  onChange={e => {
                    const selectedCompany = hubspot.companies.find(
                      c => c.id === e.target.value
                    );
                    if (selectedCompany) {
                      handleUpdate('companyId', selectedCompany.id);
                      // Pre-fill fields if company is selected
                      handleUpdate('name', selectedCompany.name || '');
                      handleUpdate('domain', selectedCompany.domain || '');
                      handleUpdate('phone', selectedCompany.phone || '');
                      handleUpdate('city', selectedCompany.city || '');
                      handleUpdate('country', selectedCompany.country || '');
                      handleUpdate('industry', selectedCompany.industry || '');
                    }
                  }}
                  disabled={!hubspot?.status?.connected || hubspot.loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: '#2a2a2a',
                    color: 'hsl(var(--foreground))',
                    marginBottom: '0.5rem',
                    opacity: !hubspot?.status?.connected ? 0.5 : 1,
                    cursor: !hubspot?.status?.connected ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="">
                    {!hubspot?.status?.connected
                      ? 'Connect HubSpot first'
                      : hubspot.loading
                        ? 'Loading companies...'
                        : hubspot.companies.length === 0
                          ? 'No companies found'
                          : 'Select a company to update...'}
                  </option>
                  {hubspot.companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.displayName}
                      {company.domain ? ` (${company.domain})` : ''}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    marginTop: '0.25rem',
                  }}
                >
                  Or enter Company ID manually below
                </div>
              </>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {!hubspot?.status?.connected
                  ? 'Connect HubSpot to load companies'
                  : hubspot.loading
                    ? 'Loading companies...'
                    : 'No companies found'}
              </div>
            )}
            <VariableAutocomplete
              value={localData.companyId || ''}
              onChange={val => {
                // If user types, clear pre-filled fields
                handleUpdate('companyId', val);
                handleUpdate('name', '');
                handleUpdate('domain', '');
                handleUpdate('phone', '');
                handleUpdate('city', '');
                handleUpdate('country', '');
                handleUpdate('industry', '');
              }}
              availableVariables={availableVariables}
              placeholder="Company ID or {{previous.output.companyId}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Company Name
            </label>
            <VariableAutocomplete
              value={localData.name || ''}
              onChange={e => handleUpdate('name', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Acme Inc or {{previous.output.companyName}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Domain
            </label>
            <VariableAutocomplete
              value={localData.domain || ''}
              onChange={e => handleUpdate('domain', e.target.value)}
              availableVariables={availableVariables}
              placeholder="acme.com or {{previous.output.domain}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Phone
            </label>
            <VariableAutocomplete
              value={localData.phone || ''}
              onChange={e => handleUpdate('phone', e.target.value)}
              availableVariables={availableVariables}
              placeholder="+1234567890 or {{previous.output.phone}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              City
            </label>
            <VariableAutocomplete
              value={localData.city || ''}
              onChange={e => handleUpdate('city', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Berlin or {{previous.output.city}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Country
            </label>
            <VariableAutocomplete
              value={localData.country || ''}
              onChange={e => handleUpdate('country', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Germany or {{previous.output.country}}"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Industry
            </label>
            <VariableAutocomplete
              value={localData.industry || ''}
              onChange={e => handleUpdate('industry', e.target.value)}
              availableVariables={availableVariables}
              placeholder="Technology or {{previous.output.industry}}"
            />
          </div>
        </>
      )}

      {/* Get Company Fields */}
      {actionType === 'get-company' && (
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
            }}
          >
            Company *
          </label>
          {hubspot?.status?.connected && hubspot.companies.length > 0 ? (
            <>
              <select
                value={localData.companyId || ''}
                onChange={e => {
                  const selectedCompany = hubspot.companies.find(
                    c => c.id === e.target.value
                  );
                  if (selectedCompany) {
                    handleUpdate('companyId', selectedCompany.id);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'hsl(var(--foreground))',
                  marginBottom: '0.5rem',
                }}
              >
                <option value="">Select a company...</option>
                {hubspot.companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.displayName}
                    {company.domain ? ` (${company.domain})` : ''}
                  </option>
                ))}
              </select>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  marginTop: '0.25rem',
                }}
              >
                Or enter Company ID or Domain manually below
              </div>
            </>
          ) : null}
          <VariableAutocomplete
            value={localData.companyId || localData.domain || ''}
            onChange={e => handleUpdate('companyId', e.target.value)}
            availableVariables={availableVariables}
            placeholder="Company ID or Domain (e.g. acme.com) or {{previous.output.companyId}}"
          />
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginTop: '0.25rem',
            }}
          >
            Search for company by ID or domain
          </div>
        </div>
      )}

      {/* Info Box */}
      <div
        style={{
          padding: '0.75rem',
          background: '#1e293b',
          borderRadius: '8px',
          border: '1px solid #334155',
          marginTop: '1rem',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            lineHeight: '1.5',
          }}
        >
          <strong style={{ color: '#fff' }}>Note:</strong> Make sure you have
          connected your HubSpot account in Settings before using this node.
        </div>
      </div>

      {/* Error Configuration */}
      <ErrorConfig
        localData={localData}
        handleUpdate={handleUpdate}
        nodeType="hubspot"
      />
    </>
  );
}

