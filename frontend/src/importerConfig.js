// Helper function to create a preview column configuration
const createPreview = (key, header, render) => ({ key, header, render });

// Configuration for the generic DataImporter component
export const importerConfig = {
  orders: {
    title: 'Import Orders',
    apiEndpoint: '/api/orders/import',
    postDataKey: 'orders', // Backend oczekuje { orders: [...] }
    dataMappingFn: (row) => ({
      order_number: row.ConsignmentNumber,
      customer_reference: row.CustomerReference,
      customer_code: row.AccountCode,
      status: 'nowe',
      sender_details: {
        name: row.CollectionName,
        address1: row.CollectionAddress1,
        address2: row.CollectionAddress2,
        townCity: row.CollectionTownCity,
        postCode: row.CollectionPostCode,
      },
      recipient_details: {
        name: row.DeliveryName,
        address1: row.DeliveryAddress1,
        address2: row.DeliveryAddress2,
        townCity: row.DeliveryTownCity,
        postCode: row.DeliveryPostCode,
      },
      loading_date_time: row.CollectionDate ? `${row.CollectionDate}T${row.CollectionTime || '12:00:00'}` : null,
      unloading_date_time: row.DeliveryDate ? `${row.DeliveryDate}T${row.DeliveryTime || '12:00:00'}` : null, // To pole jest nadal potrzebne dla sortowania/filtrowania
      // Nowa, bardziej zaawansowana logika mapowania czasu
      ...(() => {
        // Uproszczona i bardziej skalowalna logika mapowania czasu dostawy
        const timeSurchargeConfig = {
          'BW': { hours: 4, type: 'window' }, // 4-godzinne okno przed czasem dostawy
          'AM': { startTime: '09:00', type: 'before' }, // Dostawa przed czasem z pliku
          'PT': { startTime: '09:00', type: 'before' }, // Dostawa przed czasem z pliku
        };

        const surcharges = (row.Surcharges || '').split(' ').filter(Boolean);
        const deliveryTime = row.DeliveryTime || null;
        const surchargeCode = surcharges.find(code => timeSurchargeConfig[code]);

        if (surchargeCode && deliveryTime) {
          const config = timeSurchargeConfig[surchargeCode];
          const endTime = deliveryTime.slice(0, 5);
          let startTime = config.startTime; // Domyślnie użyj czasu z konfiguracji
          if (config.type === 'window') {
            const [endHour, endMinute] = endTime.split(':').map(Number);
            const date = new Date(0, 0, 0, endHour, endMinute);
            date.setHours(date.getHours() - config.hours);
            startTime = date.toTimeString().slice(0, 5);
          }
          return { unloading_start_time: startTime, unloading_end_time: endTime };
        }
        return { unloading_start_time: deliveryTime?.slice(0, 5) || null, unloading_end_time: null };
      })(),
      cargo_details: {
        description: `Spaces: ${row.TotalSpaces}, Kilos: ${row.TotalKilos}`,
        // Poprawka: Konwertujemy obiekt palet na tablicę, aby pasowała do formatu formularza.
        pallets: Object.entries({
          full: { quantity: parseInt(row.FullQ) || 0, spaces: parseFloat(row.FullS) || parseInt(row.FullQ) || 0, weight: parseFloat(row.FullW) || 0 },
          half: { quantity: parseInt(row.HalfQ) || 0, spaces: parseFloat(row.HalfS) || 0.5 * (parseInt(row.HalfQ) || 0), weight: parseFloat(row.HalfW) || 0 },
          half_plus: { quantity: parseInt(row.HalfPlusQ) || 0, spaces: parseFloat(row.HalfPlusS) || 1.5 * (parseInt(row.HalfPlusQ) || 0), weight: parseFloat(row.HalfPlusW) || 0 },
          quarter: { quantity: parseInt(row.QuarterQ) || 0, spaces: parseFloat(row.QuarterS) || 0.5 * (parseInt(row.QuarterQ) || 0), weight: parseFloat(row.QuarterW) || 0 },
          micro: { quantity: parseInt(row.MicroQ) || 0, spaces: parseFloat(row.MicroS) || 0.25 * (parseInt(row.MicroQ) || 0), weight: parseFloat(row.MicroW) || 0 },
        })
        .filter(([, details]) => details.quantity > 0)
        .map(([type, details]) => ({
          type,
          quantity: details.quantity,
          spaces: details.spaces,
          weight: details.weight,
        })),
        total_kilos: parseFloat(row.TotalKilos) || 0,
        total_spaces: parseFloat(row.TotalSpaces) || 0,
        // Mapowanie pól Amazona
        amazon_asn: row.AmazonASN,
        amazon_fbaref: row.AmazonFBARef,
        amazon_carton_count: parseInt(row.AmazonCartonCount, 10) || null,
        amazon_unit_count: parseInt(row.AmazonUnitCount, 10) || null,
        amazon_poref: row.AmazonPORef,
      },
      service_level: row.ServiceCode || 'A',
      // Odczytujemy kody dopłat, dzielimy je po spacji i filtrujemy puste wartości
      selected_surcharges: (row.Surcharges || '').split(' ').filter(Boolean),
    }),
    previewColumns: [
      createPreview('order_number', 'Consignment #'),
      createPreview('customer_code', 'Customer Code'),
      createPreview('sender_details.name', 'Sender'),
      createPreview('recipient_details.name', 'Recipient'),
    ],
  },
  customers: {
    title: 'Import Customers',
    apiEndpoint: '/api/customers/import',
    dataMappingFn: (row) => row, // No mapping needed if CSV headers match DB columns
    previewColumns: [
      createPreview('customer_code', 'Code'),
      createPreview('name', 'Name'),
      createPreview('postcode', 'Postcode'),
    ],
  },
  drivers: {
    title: 'Import Drivers',
    apiEndpoint: '/api/drivers/import',
    dataMappingFn: (row) => row,
    previewColumns: [
      createPreview('first_name', 'First Name'),
      createPreview('last_name', 'Last Name'),
      createPreview('login_code', 'Login Code'),
    ],
  },
  trucks: {
    title: 'Import Vehicles',
    apiEndpoint: '/api/trucks/import',
    postDataKey: 'trucks', // API expects { trucks: [...] }
    dataMappingFn: (row) => ({
      registration_plate: row.registration_plate || '',
      brand: row.brand || '',
      model: row.model || '',
      vin: row.vin || '',
      production_year: row.production_year ? parseInt(row.production_year, 10) : null,
      type_of_truck: row.type_of_truck || 'tractor',
      total_weight: row.total_weight ? parseInt(row.total_weight, 10) : null,
      pallet_capacity: row.pallet_capacity ? parseInt(row.pallet_capacity, 10) : null,
      max_payload_kg: row.max_payload_kg ? parseInt(row.max_payload_kg, 10) : null,
      is_active: !(row.is_deleted === 'true' || row.is_deleted === true),
    }),
    previewColumns: [
      createPreview('registration_plate', 'Reg. Plate'),
      createPreview('brand', 'Brand'),
      createPreview('type_of_truck', 'Type'),
    ],
  },
  trailers: {
    title: 'Import Trailers',
    apiEndpoint: '/api/trailers/import',
    postDataKey: 'trailers', // API expects { trailers: [...] }
    dataMappingFn: (row) => ({
      registration_plate: row.registration_plate || '',
      description: row.description || '',
      category: row.category || 'Own',
      brand: row.brand || 'Unknown',
      max_payload_kg: row.max_payload_kg ? parseInt(row.max_payload_kg, 10) : null,
      max_spaces: row.max_spaces ? parseInt(row.max_spaces, 10) : null,
      length_m: row.length_m ? parseFloat(row.length_m) : null,
      width_m: row.width_m ? parseFloat(row.width_m) : null,
      height_m: row.height_m ? parseFloat(row.height_m) : null,
      weight_kg: row.weight_kg ? parseInt(row.weight_kg, 10) : null,
      status: row.status ? row.status.toLowerCase() : 'inactive',
    }),
    previewColumns: [
      createPreview('registration_plate', 'Reg. Plate'),
      createPreview('description', 'Description'),
      createPreview('max_payload_kg', 'Payload (kg)'),
      createPreview('status', 'Status'),
    ],
  },
  users: {
    title: 'Import Users',
    apiEndpoint: '/api/users/import',
    dataMappingFn: (row) => row, // CSV headers match expected keys
    previewColumns: [
      createPreview('email', 'Email'),
      createPreview('first_name', 'First Name'),
      createPreview('last_name', 'Last Name'),
      createPreview('role', 'Role'),
    ],
  },
  zones: {
    title: 'Import Postcode Zones',
    apiEndpoint: '/api/zones/import',
    dataMappingFn: (row) => ({
      ...row,
      postcode_patterns: (row.postcode_patterns || '').split(';').map(p => p.trim()).filter(Boolean),
      is_home_zone: ['true', 'yes', '1'].includes(String(row.is_home_zone).toLowerCase()),
    }),
    previewColumns: [
      createPreview('zone_name', 'Zone Name'),
      createPreview('postcode_patterns', 'Patterns', (row) => (row.postcode_patterns || []).join(', ')),
      createPreview('is_home_zone', 'Home Zone', (row) => (row.is_home_zone ? 'Yes' : 'No')),
    ],
  },
};