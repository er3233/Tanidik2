/**
 * Venue store product attribute templates (business form + store customer UI).
 * Expects venue_products.attributes + venue_products.options (see sql/venue_product_options_mvp.sql).
 */
(function initVenueProductAttributes(global) {
  const FIELD = {
    portion: {
      key: "portion",
      label: "Porsiyon",
      type: "select",
      choices: ["Küçük", "Normal", "Büyük"],
      required: true,
    },
    spice: {
      key: "spice",
      label: "Acı seviyesi",
      type: "select",
      choices: ["Yok", "Az", "Orta", "Çok"],
      required: false,
    },
    extraSauce: {
      key: "extraSauce",
      label: "Ekstra sos",
      type: "multiselect",
      choices: ["Ketçap", "Mayonez", "Ranch", "BBQ", "Sarımsak"],
      required: false,
    },
    note: {
      key: "note",
      label: "Not",
      type: "text",
      placeholder: "Özel istek / alerji",
      required: false,
    },
    pizzaSize: {
      key: "size",
      label: "Boyut",
      type: "select",
      choices: ["Küçük", "Orta", "Büyük", "XL"],
      required: true,
    },
    dough: {
      key: "dough",
      label: "Hamur tipi",
      type: "select",
      choices: ["İnce", "Kalın", "Tam buğday"],
      required: true,
    },
    edge: {
      key: "edge",
      label: "Kenar tipi",
      type: "select",
      choices: ["Normal", "Peynirli kenar", "Sosisli kenar"],
      required: false,
    },
    pizzaExtras: {
      key: "extras",
      label: "Ekstra malzeme",
      type: "multiselect",
      choices: [
        "Peynir",
        "Mantar",
        "Sucuk",
        "Zeytin",
        "Mısır",
        "Biber",
      ],
      required: false,
    },
    volume: {
      key: "volume",
      label: "Hacim",
      type: "select",
      choices: ["250 ml", "330 ml", "500 ml", "1 L"],
      required: true,
    },
    temperature: {
      key: "temperature",
      label: "Sıcak / soğuk",
      type: "select",
      choices: ["Soğuk", "Sıcak", "Oda sıcaklığı"],
      required: true,
    },
    sugarIce: {
      key: "sugarIce",
      label: "Şeker / buz",
      type: "select",
      choices: [
        "Normal",
        "Şekersiz",
        "Az şeker",
        "Buzlu",
        "Buzsuz",
      ],
      required: false,
    },
    clothingSize: {
      key: "size",
      label: "Beden",
      type: "select",
      choices: ["XS", "S", "M", "L", "XL", "XXL"],
      required: true,
    },
    color: {
      key: "color",
      label: "Renk",
      type: "select",
      choices: ["Siyah", "Beyaz", "Gri", "Mavi", "Kırmızı", "Yeşil"],
      required: false,
    },
    fabric: {
      key: "fabric",
      label: "Kumaş",
      type: "select",
      choices: ["Pamuk", "Polyester", "Denim", "Yün", "Karma"],
      required: false,
    },
    model: {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "Örn. Galaxy S24",
      required: false,
    },
    warranty: {
      key: "warranty",
      label: "Garanti",
      type: "select",
      choices: ["Yok", "1 yıl", "2 yıl", "3 yıl"],
      required: false,
    },
    storage: {
      key: "storage",
      label: "Depolama",
      type: "select",
      choices: ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"],
      required: false,
    },
    generalSize: {
      key: "size",
      label: "Boyut",
      type: "select",
      choices: ["XS", "S", "M", "L", "XL"],
      required: false,
    },
    generalNote: {
      key: "note",
      label: "Açıklama / not",
      type: "text",
      placeholder: "Ek bilgi",
      required: false,
    },
  };

  const TEMPLATES = {
    food: {
      id: "food",
      label: "Yemek",
      fields: [FIELD.portion, FIELD.spice, FIELD.extraSauce, FIELD.note],
    },
    pizza: {
      id: "pizza",
      label: "Pizza",
      fields: [
        FIELD.pizzaSize,
        FIELD.dough,
        FIELD.edge,
        FIELD.pizzaExtras,
        FIELD.note,
      ],
    },
    drink: {
      id: "drink",
      label: "İçecek",
      fields: [FIELD.volume, FIELD.temperature, FIELD.sugarIce],
    },
    clothing: {
      id: "clothing",
      label: "Giyim",
      fields: [FIELD.clothingSize, FIELD.color, FIELD.fabric],
    },
    electronics: {
      id: "electronics",
      label: "Elektronik",
      fields: [
        FIELD.model,
        FIELD.warranty,
        FIELD.color,
        FIELD.storage,
      ],
    },
    general: {
      id: "general",
      label: "Genel",
      fields: [FIELD.color, FIELD.generalSize, FIELD.generalNote],
    },
  };

  function normalizeCategoryName(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function resolveTemplateId(categoryName) {
    const n = normalizeCategoryName(categoryName);

    if (!n) return "general";
    if (/pizza|lahmacun|pide/.test(n)) return "pizza";
    if (/icecek|içecek|drink|kahve|cay|çay|su|soguk|soğuk/.test(n)) {
      return "drink";
    }
    if (/giyim|kiyafet|kıyafet|moda|tekstil|ayakkabi|ayakkabı/.test(n)) {
      return "clothing";
    }
    if (/elektronik|telefon|bilgisayar|tablet|laptop|aksesuar/.test(n)) {
      return "electronics";
    }
    if (/yemek|menu|menü|ana yemek|tatli|tatlı|atistirmalik|atıştırma|corba|çorba/.test(n)) {
      return "food";
    }
    return "general";
  }

  function getTemplate(templateId) {
    return TEMPLATES[templateId] || TEMPLATES.general;
  }

  function cloneField(field) {
    return {
      key: field.key,
      label: field.label,
      type: field.type,
      choices: field.choices ? [...field.choices] : undefined,
      placeholder: field.placeholder || "",
      required: Boolean(field.required),
    };
  }

  function buildOptionsSchema(templateId) {
    const template = getTemplate(templateId);
    return (template.fields || []).map(cloneField);
  }

  function parseProductAttributes(raw) {
    if (!raw) return { template: "general", values: {} };
    if (typeof raw === "string") {
      try {
        return parseProductAttributes(JSON.parse(raw));
      } catch (error) {
        return { template: "general", values: {} };
      }
    }
    if (typeof raw === "object") {
      return {
        template: raw.template || raw.templateId || "general",
        values:
          raw.values && typeof raw.values === "object" ? raw.values : {},
      };
    }
    return { template: "general", values: {} };
  }

  function defaultValueForField(field) {
    if (field.type === "multiselect") return [];
    if (field.type === "select" && field.choices && field.choices.length) {
      return field.choices[0];
    }
    return "";
  }

  function summarizeAttributeValues(schema, values) {
    if (!schema || !schema.length) return "";
    const parts = [];
    schema.forEach((field) => {
      const value = values[field.key];
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        if (!value.length) return;
        parts.push(`${field.label}: ${value.join(", ")}`);
        return;
      }
      parts.push(`${field.label}: ${value}`);
    });
    return parts.join(" · ");
  }

  function isMissingAttributesColumnError(error) {
    const message = String(
      (error && (error.message || error.details || error.hint)) || ""
    ).toLowerCase();
    return (
      message.includes("attributes") ||
      message.includes("options") ||
      message.includes("schema cache") ||
      (error && error.code === "PGRST204")
    );
  }

  const api = {
    TEMPLATES,
    resolveTemplateId,
    getTemplate,
    buildOptionsSchema,
    parseProductAttributes,
    summarizeAttributeValues,
    isMissingAttributesColumnError,

    getCategoryNameById(categoryId) {
      const select = document.getElementById("businessProductCategory");
      if (!select || !categoryId) return "";
      const option = select.querySelector(
        `option[value="${CSS.escape(String(categoryId))}"]`
      );
      return option ? option.textContent.trim() : "";
    },

    renderBusinessAttributeForm(templateId, values) {
      const section = document.getElementById(
        "businessProductAttributesSection"
      );
      const fieldsHost = document.getElementById(
        "businessProductAttributesFields"
      );
      const templateLabel = document.getElementById(
        "businessProductAttributesTemplateLabel"
      );
      const jsonInput = document.getElementById(
        "businessProductAttributesJson"
      );

      if (!section || !fieldsHost) return;

      const template = getTemplate(templateId);
      section.hidden = false;
      if (templateLabel) {
        templateLabel.textContent = `Şablon: ${template.label}`;
      }

      fieldsHost.innerHTML = "";
      const mergedValues = { ...(values || {}) };

      (template.fields || []).forEach((field) => {
        const wrap = document.createElement("div");
        wrap.className = "product-attr-field";
        wrap.dataset.attrKey = field.key;
        wrap.dataset.attrType = field.type;

        const label = document.createElement("label");
        label.textContent = field.label + (field.required ? " *" : "");
        label.setAttribute("for", `productAttr_${field.key}`);
        wrap.appendChild(label);

        const current =
          mergedValues[field.key] !== undefined
            ? mergedValues[field.key]
            : defaultValueForField(field);

        if (field.type === "select") {
          const select = document.createElement("select");
          select.id = `productAttr_${field.key}`;
          select.name = `productAttr_${field.key}`;
          (field.choices || []).forEach((choice) => {
            const option = document.createElement("option");
            option.value = choice;
            option.textContent = choice;
            if (choice === current) option.selected = true;
            select.appendChild(option);
          });
          wrap.appendChild(select);
        } else if (field.type === "multiselect") {
          const group = document.createElement("div");
          group.className = "product-attr-multiselect";
          const selected = Array.isArray(current) ? current : [];
          (field.choices || []).forEach((choice) => {
            const row = document.createElement("label");
            row.className = "product-attr-check";
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = choice;
            input.name = `productAttr_${field.key}`;
            input.checked = selected.includes(choice);
            row.appendChild(input);
            row.appendChild(document.createTextNode(choice));
            group.appendChild(row);
          });
          wrap.appendChild(group);
        } else {
          const input = document.createElement(
            field.type === "text" ? "textarea" : "input"
          );
          input.id = `productAttr_${field.key}`;
          input.name = `productAttr_${field.key}`;
          if (field.placeholder) input.placeholder = field.placeholder;
          input.value = safeText(current);
          wrap.appendChild(input);
        }

        fieldsHost.appendChild(wrap);
      });

      const payload = api.collectBusinessAttributePayload(templateId);
      if (jsonInput) jsonInput.value = JSON.stringify(payload);
    },

    hideBusinessAttributeForm() {
      const section = document.getElementById(
        "businessProductAttributesSection"
      );
      const fieldsHost = document.getElementById(
        "businessProductAttributesFields"
      );
      const jsonInput = document.getElementById(
        "businessProductAttributesJson"
      );
      if (section) section.hidden = true;
      if (fieldsHost) fieldsHost.innerHTML = "";
      if (jsonInput) jsonInput.value = "";
    },

    collectBusinessAttributePayload(forcedTemplateId) {
      const categoryId = document.getElementById("businessProductCategory")
        ? document.getElementById("businessProductCategory").value
        : "";
      const categoryName = api.getCategoryNameById(categoryId);
      const templateId =
        forcedTemplateId || resolveTemplateId(categoryName);
      const template = getTemplate(templateId);
      const values = {};

      (template.fields || []).forEach((field) => {
        if (field.type === "multiselect") {
          values[field.key] = Array.from(
            document.querySelectorAll(
              `input[name="productAttr_${field.key}"]:checked`
            )
          ).map((input) => input.value);
          return;
        }
        const input = document.getElementById(`productAttr_${field.key}`);
        if (!input) return;
        values[field.key] = input.value;
      });

      return {
        template: templateId,
        values,
        options: buildOptionsSchema(templateId),
      };
    },

    fillBusinessProductFormForEdit(product, categories) {
      if (!product) return;
      const editInput = document.getElementById("businessProductEditId");
      if (editInput) editInput.value = product.id || "";

      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? "";
      };

      set("businessProductCategory", product.category_id || "");
      set("businessProductName", product.name);
      set("businessProductDescription", product.description || "");
      set(
        "businessProductPrice",
        product.price === null || product.price === undefined
          ? ""
          : product.price
      );
      set("businessProductCurrency", product.currency || "TRY");
      set("businessProductImage", product.image_url || "");
      set("businessProductStock", product.stock_quantity ?? "");
      set("businessProductSort", product.sort_order ?? 0);

      const activeInput = document.getElementById("businessProductActive");
      if (activeInput) activeInput.checked = product.is_active !== false;

      const attrs = parseProductAttributes(product.attributes);
      const category = (categories || []).find(
        (c) => String(c.id) === String(product.category_id)
      );
      const templateId =
        attrs.template ||
        resolveTemplateId(category && category.name);
      api.renderBusinessAttributeForm(templateId, attrs.values);

      const submitBtn = document.querySelector(
        "#businessProductForm button[type='submit']"
      );
      if (submitBtn) submitBtn.textContent = "Ürünü Güncelle";
    },

    resetBusinessProductEditState() {
      const editInput = document.getElementById("businessProductEditId");
      if (editInput) editInput.value = "";
      const submitBtn = document.querySelector(
        "#businessProductForm button[type='submit']"
      );
      if (submitBtn) submitBtn.textContent = "Ürünü Kaydet";
      api.hideBusinessAttributeForm();
    },

    onBusinessCategoryChange() {
      const categoryId = document.getElementById("businessProductCategory")
        ? document.getElementById("businessProductCategory").value
        : "";
      if (!categoryId) {
        api.hideBusinessAttributeForm();
        return;
      }
      const name = api.getCategoryNameById(categoryId);
      const templateId = resolveTemplateId(name);
      api.renderBusinessAttributeForm(templateId, {});
    },

    buildVenueProductExtras(payload) {
      return {
        attributes: {
          template: payload.template,
          values: payload.values,
        },
        options: payload.options,
      };
    },

    renderCustomerOptionPicker(container, product, onChange) {
      if (!container) return;
      container.innerHTML = "";

      const schema = Array.isArray(product.options) && product.options.length
        ? product.options
        : buildOptionsSchema(
            parseProductAttributes(product.attributes).template
          );

      if (!schema.length) {
        container.hidden = true;
        return;
      }

      container.hidden = false;
      const attrs = parseProductAttributes(product.attributes);
      const defaults = attrs.values || {};
      const state = {};

      schema.forEach((field) => {
        const wrap = document.createElement("div");
        wrap.className = "store-product-option";
        const label = document.createElement("span");
        label.className = "store-product-option__label";
        label.textContent = field.label + (field.required ? " *" : "");
        wrap.appendChild(label);

        const initial =
          defaults[field.key] !== undefined
            ? defaults[field.key]
            : defaultValueForField(field);
        state[field.key] = initial;

        if (field.type === "select") {
          const select = document.createElement("select");
          select.className = "store-product-option__control";
          (field.choices || []).forEach((choice) => {
            const opt = document.createElement("option");
            opt.value = choice;
            opt.textContent = choice;
            if (choice === initial) opt.selected = true;
            select.appendChild(opt);
          });
          select.addEventListener("change", () => {
            state[field.key] = select.value;
            if (typeof onChange === "function") onChange({ ...state });
          });
          wrap.appendChild(select);
        } else if (field.type === "multiselect") {
          const group = document.createElement("div");
          group.className = "store-product-option__checks";
          const selected = Array.isArray(initial) ? initial : [];
          state[field.key] = selected;
          (field.choices || []).forEach((choice) => {
            const row = document.createElement("label");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = choice;
            input.checked = selected.includes(choice);
            input.addEventListener("change", () => {
              state[field.key] = Array.from(
                group.querySelectorAll("input:checked")
              ).map((el) => el.value);
              if (typeof onChange === "function") onChange({ ...state });
            });
            row.appendChild(input);
            row.appendChild(document.createTextNode(choice));
            group.appendChild(row);
          });
          wrap.appendChild(group);
        } else {
          const input = document.createElement("textarea");
          input.className = "store-product-option__control";
          input.rows = 2;
          input.value = safeText(initial);
          input.addEventListener("input", () => {
            state[field.key] = input.value;
            if (typeof onChange === "function") onChange({ ...state });
          });
          wrap.appendChild(input);
        }

        container.appendChild(wrap);
      });

      if (typeof onChange === "function") onChange({ ...state });
      return state;
    },

    validateCustomerSelections(schema, selections) {
      for (const field of schema || []) {
        if (!field.required) continue;
        const value = selections[field.key];
        if (field.type === "multiselect") {
          if (!Array.isArray(value) || !value.length) {
            return `${field.label} seçin`;
          }
        } else if (!safeText(value)) {
          return `${field.label} gerekli`;
        }
      }
      return "";
    },

    getProductOptionsSchema(product) {
      if (Array.isArray(product.options) && product.options.length) {
        return product.options;
      }
      return buildOptionsSchema(
        parseProductAttributes(product.attributes).template
      );
    },

    formatSelectionsForDisplay(product, selections) {
      const schema = api.getProductOptionsSchema(product);
      return summarizeAttributeValues(schema, selections || {});
    },

    cartLineKey(productId, selections) {
      return `${productId}::${JSON.stringify(selections || {})}`;
    },
  };

  function safeText(value) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  global.VenueProductAttributes = api;
})(typeof window !== "undefined" ? window : globalThis);
